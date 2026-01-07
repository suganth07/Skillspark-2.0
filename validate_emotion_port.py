#!/usr/bin/env python3
"""
Validation script to compare TypeScript emotion detection with Python implementation.
This helps ensure the port is accurate by running the same image through both.

Usage:
    python validate_emotion_port.py test_image.jpg
"""

import sys
import json
import subprocess
from pathlib import Path

def run_python_detection(image_path: str) -> dict:
    """Run Python emotion detection"""
    try:
        # Import Python implementation
        from predict import predict_emotion_from_image
        
        result = predict_emotion_from_image(image_path)
        return {
            "emotion": result["emotion"],
            "confidence": round(result["confidence"], 4),
            "features": {k: round(v, 4) if isinstance(v, float) else v 
                        for k, v in result["features"].items()}
        }
    except Exception as e:
        return {"error": str(e)}

def run_typescript_detection(image_path: str) -> dict:
    """Run TypeScript emotion detection via Node"""
    # Create a temporary TypeScript runner
    ts_code = f"""
import {{ detectEmotionFromImageUri }} from './lib/emotion/detectEmotion';

async function main() {{
  const result = await detectEmotionFromImageUri('file://{image_path}');
  console.log(JSON.stringify(result, null, 2));
}}

main().catch(console.error);
"""
    
    temp_file = Path("temp_validate.ts")
    temp_file.write_text(ts_code)
    
    try:
        # Run with tsx or ts-node
        result = subprocess.run(
            ["npx", "tsx", str(temp_file)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return {"error": result.stderr}
        
        return json.loads(result.stdout)
    except Exception as e:
        return {"error": str(e)}
    finally:
        if temp_file.exists():
            temp_file.unlink()

def compare_results(python_result: dict, ts_result: dict):
    """Compare Python and TypeScript results"""
    print("\n" + "="*60)
    print("VALIDATION RESULTS")
    print("="*60)
    
    if "error" in python_result:
        print(f"❌ Python Error: {python_result['error']}")
        return
    
    if "error" in ts_result:
        print(f"❌ TypeScript Error: {ts_result['error']}")
        return
    
    # Compare emotion
    print(f"\n📊 Emotion Detection:")
    print(f"  Python:     {python_result['emotion']}")
    print(f"  TypeScript: {ts_result['emotion']}")
    
    emotion_match = python_result['emotion'] == ts_result['emotion']
    print(f"  Match: {'✅' if emotion_match else '❌'}")
    
    # Compare confidence
    print(f"\n📈 Confidence:")
    print(f"  Python:     {python_result['confidence']:.4f}")
    print(f"  TypeScript: {ts_result['confidence']:.4f}")
    
    conf_diff = abs(python_result['confidence'] - ts_result['confidence'])
    conf_match = conf_diff < 0.05  # Allow 5% difference
    print(f"  Difference: {conf_diff:.4f}")
    print(f"  Match: {'✅' if conf_match else '⚠️ ' if conf_diff < 0.1 else '❌'}")
    
    # Compare features
    print(f"\n🔍 Feature Comparison:")
    
    py_features = python_result.get('features', {})
    ts_features = ts_result.get('features', {})
    
    all_features = set(py_features.keys()) | set(ts_features.keys())
    
    feature_matches = 0
    feature_total = 0
    
    for feature in sorted(all_features):
        py_val = py_features.get(feature)
        ts_val = ts_features.get(feature)
        
        if py_val is None or ts_val is None:
            print(f"  {feature:20s} - Missing in {'TS' if py_val else 'Python'} ❌")
            feature_total += 1
            continue
        
        feature_total += 1
        
        # Handle boolean features
        if isinstance(py_val, bool):
            match = py_val == ts_val
            feature_matches += int(match)
            print(f"  {feature:20s} - Python: {py_val:5}, TS: {ts_val:5} {'✅' if match else '❌'}")
            continue
        
        # Handle numeric features
        if isinstance(py_val, (int, float)):
            diff = abs(float(py_val) - float(ts_val))
            
            # Different tolerances for different features
            if feature in ['ear', 'mar', 'brow_height', 'rotation_ratio', 'symmetry_ratio']:
                tolerance = 0.05
            elif feature in ['tilt_angle']:
                tolerance = 2.0  # degrees
            else:
                tolerance = 0.1
            
            match = diff < tolerance
            feature_matches += int(match)
            
            status = '✅' if match else ('⚠️' if diff < tolerance * 2 else '❌')
            print(f"  {feature:20s} - Python: {py_val:7.4f}, TS: {ts_val:7.4f}, Diff: {diff:7.4f} {status}")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Emotion Match:  {'✅ PASS' if emotion_match else '❌ FAIL'}")
    print(f"Confidence:     {'✅ PASS' if conf_match else '⚠️ CLOSE' if conf_diff < 0.1 else '❌ FAIL'}")
    print(f"Features:       {feature_matches}/{feature_total} matching")
    
    overall_pass = emotion_match and conf_match and (feature_matches / feature_total > 0.8)
    print(f"\nOverall: {'✅ PASS - TypeScript port is accurate!' if overall_pass else '⚠️ REVIEW - Some differences detected'}")
    print(f"{'='*60}\n")

def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_emotion_port.py <image_path>")
        print("\nExample:")
        print("  python validate_emotion_port.py test_image.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not Path(image_path).exists():
        print(f"❌ Error: Image not found: {image_path}")
        sys.exit(1)
    
    print(f"🔍 Validating emotion detection port...")
    print(f"📸 Image: {image_path}")
    
    # Run both implementations
    print("\n⏳ Running Python detection...")
    python_result = run_python_detection(image_path)
    
    print("⏳ Running TypeScript detection...")
    ts_result = run_typescript_detection(str(Path(image_path).absolute()))
    
    # Compare
    compare_results(python_result, ts_result)

if __name__ == "__main__":
    main()
