from PIL import Image
import numpy as np

# Load and resize exactly like training
img = Image.open('assets/images/4.jpg').convert('RGB')
print(f'Original size: {img.size}')

img_resized = img.resize((224, 224), Image.BILINEAR)
img_resized.save('assets/images/4_resized_224.jpg', quality=100, subsampling=0)

# Verify pixels
pixels = np.array(img_resized)
print('First 3 pixels:', pixels[0, 0:3])
print('Mean:', pixels.mean())
print('Saved: assets/images/1_resized_224.jpg')
