import os
from pathlib import Path
import numpy as np
import tensorflow as tf
from PIL import Image

# =========================
# SETTINGS
# =========================
MODEL_PATH = Path("assets/model/engagement6.keras")
TFLITE_INT8_PATH = Path("assets/model/engagement6_int8_dynamic.tflite")
TFLITE_FP16_PATH = Path("assets/model/engagement6_fp16.tflite")
LABELS_PATH = Path("assets/model/labels.txt")
TEST_IMAGE_PATH = Path("test_image.jpeg")
IMG_SIZE = (224, 224)

# =========================
# LOAD LABELS
# =========================
print("Loading labels...")
labels = LABELS_PATH.read_text(encoding="utf-8").strip().split("\n")
print(f"✅ Labels loaded: {labels}")

# =========================
# LOAD AND PREPROCESS IMAGE
# =========================
print(f"\nLoading test image: {TEST_IMAGE_PATH}")
img = Image.open(TEST_IMAGE_PATH).convert("RGB")
print(f"Original image size: {img.size}")

# Check for EXIF orientation and apply it (like React Native does)
from PIL import ExifTags
try:
    exif = img._getexif()
    if exif:
        for tag, value in exif.items():
            if ExifTags.TAGS.get(tag) == 'Orientation':
                print(f"EXIF Orientation tag found: {value}")
                if value == 3:
                    img = img.rotate(180, expand=True)
                elif value == 6:
                    img = img.rotate(270, expand=True)
                elif value == 8:
                    img = img.rotate(90, expand=True)
                print(f"After EXIF rotation: {img.size}")
                break
except Exception as e:
    print(f"No EXIF data or error: {e}")

# Resize to model input size
img_resized = img.resize(IMG_SIZE)
img_array = np.array(img_resized, dtype=np.float32)
print(f"First 3 pixels after resize: {img_array[0, 0:3, :]}")

# Add batch dimension
img_batch = np.expand_dims(img_array, axis=0)

# =========================
# TEST 1: Keras model WITH preprocessing (original - double preprocessing)
# =========================
print("\n" + "="*60)
print("TEST 1: Keras model WITH preprocess_input (double preprocessing)")
print("="*60)
model = tf.keras.models.load_model(str(MODEL_PATH))
img_preprocessed = tf.keras.applications.mobilenet_v3.preprocess_input(img_batch.copy())
predictions = model.predict(img_preprocessed, verbose=0)
print(f"Input range: [{img_preprocessed.min():.2f}, {img_preprocessed.max():.2f}]")
for i, (label, prob) in enumerate(zip(labels, predictions[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner: {labels[np.argmax(predictions[0])]} ({predictions[0].max()*100:.2f}%)")

# =========================
# TEST 2: Keras model WITHOUT preprocessing (raw 0-255)
# =========================
print("\n" + "="*60)
print("TEST 2: Keras model WITHOUT preprocess_input (raw 0-255)")
print("="*60)
predictions = model.predict(img_batch, verbose=0)
print(f"Input range: [{img_batch.min():.2f}, {img_batch.max():.2f}]")
for i, (label, prob) in enumerate(zip(labels, predictions[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner: {labels[np.argmax(predictions[0])]} ({predictions[0].max()*100:.2f}%)")

# =========================
# TEST 3: TFLite model with raw 0-255 (what React Native is doing)
# =========================
print("\n" + "="*60)
print("TEST 3: TFLite INT8 model with raw 0-255")
print("="*60)
interpreter = tf.lite.Interpreter(model_path=str(TFLITE_INT8_PATH))
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print(f"TFLite input dtype: {input_details[0]['dtype']}")
print(f"TFLite input shape: {input_details[0]['shape']}")
print(f"First 10 pixels: {img_batch[0, 0, 0:10, :].flatten()[:10]}")  # Compare with React Native

interpreter.set_tensor(input_details[0]['index'], img_batch)
interpreter.invoke()
tflite_output = interpreter.get_tensor(output_details[0]['index'])

print(f"Input range: [{img_batch.min():.2f}, {img_batch.max():.2f}]")
for i, (label, prob) in enumerate(zip(labels, tflite_output[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner (center crop): {labels[np.argmax(tflite_output[0])]} ({tflite_output[0].max()*100:.2f}%)")

# =========================
# TEST 6: TFLite FP16 model
# =========================
print("\n" + "="*60)
print("TEST 6: TFLite FP16 model with raw 0-255")
print("="*60)
interpreter_fp16 = tf.lite.Interpreter(model_path=str(TFLITE_FP16_PATH))
interpreter_fp16.allocate_tensors()
input_details_fp16 = interpreter_fp16.get_input_details()
output_details_fp16 = interpreter_fp16.get_output_details()

interpreter_fp16.set_tensor(input_details_fp16[0]['index'], img_batch)
interpreter_fp16.invoke()
tflite_output_fp16 = interpreter_fp16.get_tensor(output_details_fp16[0]['index'])

for i, (label, prob) in enumerate(zip(labels, tflite_output_fp16[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner (FP16): {labels[np.argmax(tflite_output_fp16[0])]} ({tflite_output_fp16[0].max()*100:.2f}%)")

# =========================
# TEST 7: Simulate React Native pixels on FP16
# =========================
print("\n" + "="*60)
print("TEST 7: FP16 model with SIMULATED React Native pixel values")
print("="*60)

# RN reported first pixels: [182, 201, 196] - let's create image with similar mean
fake_img = np.full((1, 224, 224, 3), 150.0, dtype=np.float32)  # Use RN's mean: 150.271
interpreter_fp16.set_tensor(input_details_fp16[0]['index'], fake_img)
interpreter_fp16.invoke()
tflite_output_fake = interpreter_fp16.get_tensor(output_details_fp16[0]['index'])

for i, (label, prob) in enumerate(zip(labels, tflite_output_fake[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner (fake pixels): {labels[np.argmax(tflite_output_fake[0])]} ({tflite_output_fake[0].max()*100:.2f}%)")# =========================
# TEST 5: TFLite with center crop (what RN might be doing)
# =========================
print("\n" + "="*60)
print("TEST 5: TFLite with CENTER CROP (possible RN behavior)")
print("="*60)

# Reload original image
img = Image.open(TEST_IMAGE_PATH).convert("RGB")
w, h = img.size

# Center crop to square first, then resize
if w > h:
    left = (w - h) // 2
    img_cropped = img.crop((left, 0, left + h, h))
else:
    top = (h - w) // 2
    img_cropped = img.crop((0, top, w, top + w))

img_cropped_resized = img_cropped.resize(IMG_SIZE)
img_cropped_array = np.array(img_cropped_resized, dtype=np.float32)
print(f"Center crop first 3 pixels: {img_cropped_array[0, 0:3, :]}")

img_cropped_batch = np.expand_dims(img_cropped_array, axis=0)
interpreter.set_tensor(input_details[0]['index'], img_cropped_batch)
interpreter.invoke()
tflite_output = interpreter.get_tensor(output_details[0]['index'])

for i, (label, prob) in enumerate(zip(labels, tflite_output[0])):
    print(f"  {i}: {label:15s}: {prob*100:6.2f}%")
print(f"Winner: {labels[np.argmax(tflite_output[0])]} ({tflite_output[0].max()*100:.2f}%)")
