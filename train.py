
import os, random
from pathlib import Path
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt

# =========================
# 0) SETTINGS (EDIT THIS ONLY)
# =========================
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)

DATASET_ROOT = Path("/kaggle/input/studentengagement/Student-engagement-dataset")  # <-- your root folder
VAL_RATIO = 0.20

IMG_SIZE = (224, 224)
BATCH = 32
EPOCHS_HEAD = 4
EPOCHS_FINE = 6

WORKDIR = Path("/kaggle/working/workdir")
WORKDIR.mkdir(parents=True, exist_ok=True)

SAVEDMODEL_DIR = WORKDIR / "savedmodel_mnv3small_6class"
TFLITE_FP16 = WORKDIR / "engagement6_fp16.tflite"
TFLITE_INT8 = WORKDIR / "engagement6_int8_dynamic.tflite"
LABELS_TXT = WORKDIR / "labels.txt"

# =========================
# 1) BUILD FILE LISTS FROM YOUR EXACT STRUCTURE
#    Engaged/{confused, engaged, frustrated}
#    Not engaged/{Looking Away, bored, drowsy}
# =========================
def is_image(p: Path) -> bool:
    return p.suffix.lower() in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]

def norm_label(name: str) -> str:
    return name.strip().lower().replace(" ", "_")

# Explicitly define your 6 subclasses
SUBCLASS_PATHS = [
    ("Engaged", "confused"),
    ("Engaged", "engaged"),
    ("Engaged", "frustrated"),
    ("Not engaged", "Looking Away"),
    ("Not engaged", "bored"),
    ("Not engaged", "drowsy"),
]

# Collect all images
paths = []
labels = []

for top, sub in SUBCLASS_PATHS:
    folder = DATASET_ROOT / top / sub
    if not folder.exists():
        raise RuntimeError(f"Missing folder: {folder}")

    label_name = norm_label(sub)
    imgs = [p for p in folder.rglob("*") if p.is_file() and is_image(p)]
    if len(imgs) == 0:
        raise RuntimeError(f"No images found in: {folder}")

    paths.extend([str(p) for p in imgs])
    labels.extend([label_name] * len(imgs))

print("Total images:", len(paths))
print("Label counts:", {k: labels.count(k) for k in sorted(set(labels))})

# Make label -> index mapping (fixed order for reproducibility)
class_names = sorted(list(set(labels)))
label_to_idx = {name: i for i, name in enumerate(class_names)}
y = np.array([label_to_idx[l] for l in labels], dtype=np.int32)
paths = np.array(paths)

# Save labels for mobile app
LABELS_TXT.write_text("\n".join(class_names), encoding="utf-8")
print("✅ labels.txt:", LABELS_TXT)
print("Class order:", class_names)

# =========================
# 2) STRATIFIED TRAIN/VAL SPLIT
# =========================
idxs = np.arange(len(paths))
train_idx = []
val_idx = []

for c in range(len(class_names)):
    c_idxs = idxs[y == c]
    np.random.shuffle(c_idxs)
    split = int(len(c_idxs) * (1 - VAL_RATIO))
    train_idx.extend(c_idxs[:split])
    val_idx.extend(c_idxs[split:])

train_idx = np.array(train_idx)
val_idx = np.array(val_idx)
np.random.shuffle(train_idx)
np.random.shuffle(val_idx)

x_train, y_train = paths[train_idx], y[train_idx]
x_val, y_val = paths[val_idx], y[val_idx]

print("Train:", len(x_train), "Val:", len(x_val))

# =========================
# 3) TF.DATA PIPELINE
# =========================
AUTOTUNE = tf.data.AUTOTUNE

def decode_image(path, label):
    img = tf.io.read_file(path)
    img = tf.image.decode_jpeg(img, channels=3)  # dataset looks jpg-heavy; safe enough
    img = tf.image.resize(img, IMG_SIZE)
    img = tf.cast(img, tf.float32)
    return img, label

data_aug = tf.keras.Sequential([
    tf.keras.layers.RandomFlip("horizontal"),
    tf.keras.layers.RandomRotation(0.05),
    tf.keras.layers.RandomZoom(0.05),
    tf.keras.layers.RandomContrast(0.08),
], name="augment")

def augment(img, label):
    return data_aug(img, training=True), label

train_ds = tf.data.Dataset.from_tensor_slices((x_train, y_train))
train_ds = train_ds.shuffle(2000, seed=SEED, reshuffle_each_iteration=True)
train_ds = train_ds.map(decode_image, num_parallel_calls=AUTOTUNE)
train_ds = train_ds.map(augment, num_parallel_calls=AUTOTUNE)
train_ds = train_ds.batch(BATCH).prefetch(AUTOTUNE)

val_ds = tf.data.Dataset.from_tensor_slices((x_val, y_val))
val_ds = val_ds.map(decode_image, num_parallel_calls=AUTOTUNE)
val_ds = val_ds.batch(BATCH).prefetch(AUTOTUNE)

# =========================
# 4) MODEL: MobileNetV3Small (mobile-friendly)
# =========================
preprocess = tf.keras.applications.mobilenet_v3.preprocess_input

base = tf.keras.applications.MobileNetV3Small(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights="imagenet"
)
base.trainable = False  # Phase 1

inputs = tf.keras.Input(shape=IMG_SIZE + (3,), name="image")
x = preprocess(inputs)
x = base(x, training=False)
x = tf.keras.layers.GlobalAveragePooling2D()(x)
x = tf.keras.layers.Dropout(0.25)(x)
outputs = tf.keras.layers.Dense(len(class_names), activation="softmax")(x)
model = tf.keras.Model(inputs, outputs)

# =========================
# 5) TRAIN (and record history for plots)
# =========================
history_all = {"loss": [], "val_loss": [], "accuracy": [], "val_accuracy": []}
def collect(hist):
    for k in history_all:
        history_all[k].extend(hist.history.get(k, []))

callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=2, restore_best_weights=True),
]

# ---- Phase 1: head only
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)
print("\n=== PHASE 1: head only ===")
h1 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD, callbacks=callbacks)
collect(h1)

# ---- Phase 2: fine-tune last layers
base.trainable = True
for layer in base.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-4),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)
print("\n=== PHASE 2: fine-tuning ===")
h2 = model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS_FINE, callbacks=callbacks)
collect(h2)

val_loss, val_acc = model.evaluate(val_ds, verbose=0)
print(f"\n✅ Final Val Acc: {val_acc:.4f} | Val Loss: {val_loss:.4f}")

# =========================
# 6) PLOTS: Train/Val Loss + Accuracy
# =========================
epochs = range(1, len(history_all["loss"]) + 1)

plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.plot(epochs, history_all["loss"], label="Train Loss")
plt.plot(epochs, history_all["val_loss"], label="Val Loss")
plt.xlabel("Epoch"); plt.ylabel("Loss")
plt.title("Train vs Val Loss")
plt.legend(); plt.grid(True)

plt.subplot(1, 2, 2)
plt.plot(epochs, history_all["accuracy"], label="Train Acc")
plt.plot(epochs, history_all["val_accuracy"], label="Val Acc")
plt.xlabel("Epoch"); plt.ylabel("Accuracy")
plt.title("Train vs Val Accuracy")
plt.legend(); plt.grid(True)

plt.tight_layout()
plt.show()

# =========================
# 7) EXPORT SavedModel (Keras 3 compatible)
# =========================
# Keras format (optional but useful)
KERAS_FILE = WORKDIR / "engagement6.keras"
model.save(str(KERAS_FILE))
print("✅ Keras model saved at:", KERAS_FILE)

# SavedModel export (required for TFLite in Keras 3)
model.export(str(SAVEDMODEL_DIR))
print("✅ SavedModel exported at:", SAVEDMODEL_DIR)

# =========================
# 8) EXPORT TFLite (FP16)
# =========================
converter = tf.lite.TFLiteConverter.from_saved_model(str(SAVEDMODEL_DIR))
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]
tflite_fp16 = converter.convert()
TFLITE_FP16.write_bytes(tflite_fp16)
print("✅ FP16 TFLite:", TFLITE_FP16)

# =========================
# 9) EXPORT TFLite (INT8 dynamic range)
# =========================
converter = tf.lite.TFLiteConverter.from_saved_model(str(SAVEDMODEL_DIR))
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_int8 = converter.convert()
TFLITE_INT8.write_bytes(tflite_int8)
print("✅ INT8 (dynamic) TFLite:", TFLITE_INT8)
