// // import React, { useState, useEffect, useRef, useMemo } from 'react';
// // import { View, StyleSheet, ActivityIndicator, Dimensions, Image, Platform } from 'react-native';
// // import { CameraView, useCameraPermissions } from 'expo-camera';
// // import { Text } from '@/components/ui/text';
// // import { Card } from '@/components/ui/card';
// // import Animated, { FadeIn } from 'react-native-reanimated';
// // import { Brain, Camera } from 'lucide-react-native';

// // import * as ImageManipulator from 'expo-image-manipulator';
// // import { Buffer } from 'buffer';
// // import jpeg from 'jpeg-js';

// // // Test image - pre-resized to 224x224 by Python to match exactly
// // const TEST_IMAGE = require('@/assets/images/test_image_224.jpeg');

// // // Conditionally import TFLite only if the native module is available
// // let useTensorflowModel: any = null;
// // let isTfliteAvailable = false;

// // try {
// //   // Only attempt to import on native platforms where it should work
// //   if (Platform.OS !== 'web') {
// //     const tflite = require('react-native-fast-tflite');
// //     useTensorflowModel = tflite.useTensorflowModel;
// //     isTfliteAvailable = true;
// //   }
// // } catch (error) {
// //   console.warn('TensorFlow Lite native module not available:', error);
// //   isTfliteAvailable = false;
// // }

// // interface EmotionResult {
// //   emotion: string;
// //   confidence: number;
// //   timestamp: Date;
// // }

// // interface TopicEmotionDetectorProps {
// //   onEmotionDetected?: (emotion: string, confidence: number) => void;
// // }

// // /**
// //  * IMPORTANT:
// //  * - This component requires a Dev Client (not Expo Go), because fast-tflite is native.
// //  * - Ensure metro.config.js includes "tflite" in assetExts.
// //  */

// // // Keep your label order EXACTLY as your model output order.
// // // If you have labels.txt and it's different, update this array.
// // const EMOTIONS = ['wbored', 'confused', 'drowsy', 'engaged', 'frustrated', 'looking_away'];

// // const DETECTION_INTERVAL = 10000; // 10 seconds
// // const { width: screenWidth } = Dimensions.get('window');

// // function argMax(arr: ArrayLike<number>) {
// //   let bestIdx = 0;
// //   let bestVal = arr[0] ?? -Infinity;
// //   for (let i = 1; i < arr.length; i++) {
// //     const v = arr[i]!;
// //     if (v > bestVal) {
// //       bestVal = v;
// //       bestIdx = i;
// //     }
// //   }
// //   return { index: bestIdx, value: bestVal };
// // }

// // function softmax(logits: ArrayLike<number>) {
// //   // stable softmax
// //   let max = -Infinity;
// //   for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i] as number);
// //   const exps = new Float32Array(logits.length);
// //   let sum = 0;
// //   for (let i = 0; i < logits.length; i++) {
// //     const e = Math.exp((logits[i] as number) - max);
// //     exps[i] = e;
// //     sum += e;
// //   }
// //   for (let i = 0; i < exps.length; i++) exps[i] = exps[i] / (sum || 1);
// //   return exps;
// // }

// // async function photoToRgbUint8(uri: string, width: number, height: number) {
// //   console.log('📷 Processing image URI:', uri);
  
// //   // Get base64 without resizing (image should already be 224x224)
// //   const result = await ImageManipulator.manipulateAsync(
// //     uri,
// //     [], // No operations - image is already correct size
// //     { 
// //       compress: 1, 
// //       format: ImageManipulator.SaveFormat.JPEG, 
// //       base64: true,
// //     }
// //   );

// //   console.log('📷 Image dimensions:', result.width, 'x', result.height);

// //   if (!result.base64) throw new Error('No base64 returned from ImageManipulator');

// //   // Decode JPEG -> RGBA
// //   const jpgBytes = Buffer.from(result.base64, 'base64');
// //   const decoded = jpeg.decode(jpgBytes, { useTArray: true, formatAsRGBA: true });

// //   console.log('📷 Decoded JPEG dimensions:', decoded.width, 'x', decoded.height);

// //   // Convert RGBA -> RGB
// //   const rgba = decoded.data; // Uint8Array length = w*h*4
// //   const rgb = new Uint8Array(decoded.width * decoded.height * 3);

// //   let j = 0;
// //   for (let i = 0; i < rgba.length; i += 4) {
// //     rgb[j++] = rgba[i]; // R
// //     rgb[j++] = rgba[i + 1]; // G
// //     rgb[j++] = rgba[i + 2]; // B
// //   }

// //   // Log first few RGB triplets for comparison with Python
// //   console.log('📷 First 3 pixels (RGB):', 
// //     `[${rgb[0]}, ${rgb[1]}, ${rgb[2]}]`,
// //     `[${rgb[3]}, ${rgb[4]}, ${rgb[5]}]`,
// //     `[${rgb[6]}, ${rgb[7]}, ${rgb[8]}]`
// //   );

// //   return rgb;
// // }

// // export function TopicEmotionDetector({ onEmotionDetected }: TopicEmotionDetectorProps) {
// //   const [permission, requestPermission] = useCameraPermissions();
// //   const [emotion, setEmotion] = useState<EmotionResult | null>(null);
// //   const [isProcessing, setIsProcessing] = useState(false);
// //   const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
// //   const [capturedImage, setCapturedImage] = useState<string | null>(null);
// //   const cameraRef = useRef<CameraView>(null);

// //   // Choose ONE model:
// //   // - int8 dynamic: usually fastest, input often uint8 (0..255)
// //   // - fp16: often expects float32 normalized (0..1) depending on conversion
// //   const modelAsset = useMemo(
// //     () => isTfliteAvailable ? require('@/assets/model/engagement6_fp16.tflite') : null,
// //     []
// //   );
  
// //   // Only use TensorFlow model if available
// //   const tflite = isTfliteAvailable && useTensorflowModel && modelAsset ? useTensorflowModel(modelAsset) : null;
// //   const model = tflite?.state === 'loaded' ? tflite.model : undefined;

// //   // ---- tweak these to match your model ----
// //   const INPUT_W = 224;
// //   const INPUT_H = 224;

// //   // MobileNetV3 preprocess_input expects [0-255] range, not [0-1]
// //   const USE_FLOAT_INPUT_0_255 = true;
// //   // ----------------------------------------

// //   // Early return if TFLite is not available
// //   if (!isTfliteAvailable) {
// //     return (
// //       <Card className="mx-4 mb-4 border-yellow-500">
// //         <View className="p-4">
// //           <View className="flex-row items-center space-x-2 mb-2">
// //             <Brain className="h-5 w-5 text-yellow-600" />
// //             <Text className="font-semibold text-yellow-700">Emotion Detection Unavailable</Text>
// //           </View>
// //           <Text className="text-sm text-muted-foreground">
// //             Emotion detection requires a development build with native modules. This feature is not available in Expo Go.
// //           </Text>
// //         </View>
// //       </Card>
// //     );
// //   }

// //   useEffect(() => {
// //     // Use test image instead of camera
// //     const interval = setInterval(() => {
// //       detectEmotion();
// //       setCountdown(DETECTION_INTERVAL / 1000);
// //     }, DETECTION_INTERVAL);

// //     const initialTimeout = setTimeout(() => {
// //       detectEmotion();
// //     }, 2000);

// //     return () => {
// //       clearInterval(interval);
// //       clearTimeout(initialTimeout);
// //     };
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, [model]);

// //   useEffect(() => {
// //     const timer = setInterval(() => {
// //       setCountdown((prev) => (prev <= 1 ? DETECTION_INTERVAL / 1000 : prev - 1));
// //     }, 1000);

// //     return () => clearInterval(timer);
// //   }, []);

// //   const detectEmotion = async () => {
// //     if (isProcessing) return;

// //     if (!model) {
// //       // model still loading
// //       return;
// //     }

// //     setIsProcessing(true);

// //     try {
// //       // Use test image instead of camera
// //       const photo = { uri: Image.resolveAssetSource(TEST_IMAGE).uri };
// //       setCapturedImage(photo.uri);

// //       const rgb = await photoToRgbUint8(photo.uri, INPUT_W, INPUT_H);

// //       // MobileNetV3 preprocess_input expects Float32 with [0-255] range
// //       // The model will internally convert to [-1, 1]
// //       const inputTensor = USE_FLOAT_INPUT_0_255
// //         ? Float32Array.from(rgb)  // Convert uint8 [0-255] to float32 [0-255]
// //         : rgb;

// //       // Log input tensor stats
// //       let min = Infinity, max = -Infinity, sum = 0;
// //       for (let i = 0; i < inputTensor.length; i++) {
// //         const val = inputTensor[i];
// //         if (val < min) min = val;
// //         if (val > max) max = val;
// //         sum += val;
// //       }
// //       const mean = sum / inputTensor.length;
// //       console.log('📊 Input tensor stats:', {
// //         type: inputTensor.constructor.name,
// //         length: inputTensor.length,
// //         min,
// //         max,
// //         mean: mean.toFixed(3),
// //         first10: Array.from(inputTensor.slice(0, 10)),
// //       });

// //       // Run inference
// //       const outputs = model.runSync([inputTensor]);
      
// //       // Model outputs probabilities directly
// //       const probs = outputs[0] as Float32Array;
      
// //       // Log all probabilities with labels
// //       console.log('📊 Model output probabilities:');
// //       EMOTIONS.forEach((emotion, i) => {
// //         console.log(`   ${i}: ${emotion} = ${(probs[i] * 100).toFixed(2)}%`);
// //       });
      
// //       const { index } = argMax(probs);
// //       const predicted = EMOTIONS[index] ?? 'unknown';
// //       const confidence = probs[index] ?? 0;
      
// //       console.log(`🎯 Winner: index=${index}, emotion=${predicted}, confidence=${(confidence * 100).toFixed(2)}%`);

// //       const result: EmotionResult = {
// //         emotion: predicted,
// //         confidence,
// //         timestamp: new Date(),
// //       };

// //       setEmotion(result);
// //       onEmotionDetected?.(result.emotion, result.confidence);

// //       console.log('✅ TFLite Emotion detected:', result);
// //     } catch (error) {
// //       console.error('Error detecting emotion:', error);
// //     } finally {
// //       setIsProcessing(false);
// //     }
// //   };

// //   const getEmotionColor = (emotionName: string): string => {
// //     const colors: Record<string, string> = {
// //       engaged: '#4CAF50',
// //       confused: '#FF9800',
// //       frustrated: '#F44336',
// //       drowsy: '#9C27B0',
// //       wbored: '#2196F3',
// //       looking_away: '#607D8B',
// //     };
// //     return colors[emotionName] || '#999';
// //   };

// //   const getEmotionEmoji = (emotionName: string): string => {
// //     const emojis: Record<string, string> = {
// //       engaged: '😊',
// //       confused: '😕',
// //       frustrated: '😤',
// //       drowsy: '😴',
// //       wbored: '😐',
// //       looking_away: '👀',
// //     };
// //     return emojis[emotionName] || '😐';
// //   };

// //   const getEmotionLabel = (emotionName: string): string => {
// //     const labels: Record<string, string> = {
// //       engaged: 'Engaged',
// //       confused: 'Confused',
// //       frustrated: 'Frustrated',
// //       drowsy: 'Drowsy',
// //       wbored: 'Bored',
// //       looking_away: 'Distracted',
// //     };
// //     return labels[emotionName] || emotionName;
// //   };

// //   return (
// //     <View className="mb-6">

// //       <Card>
// //         <View className="p-4">
// //           <View className="flex-row items-center justify-between mb-3">
// //             <View className="flex-row items-center gap-2">
// //               <Brain size={18} className="text-purple-600 dark:text-purple-400" />
// //               <Text className="text-sm font-semibold">Learning Engagement (Test Mode)</Text>
// //             </View>

// //             <View className="flex-row items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
// //               <Camera size={14} className="text-foreground" />
// //               <Text className="text-xs font-medium">
// //                 {tflite.state !== 'loaded' ? 'Loading model…' : `Next: ${countdown}s`}
// //               </Text>
// //             </View>
// //           </View>

// //           {emotion && (
// //             <Animated.View entering={FadeIn.duration(300)} className="flex-row items-center gap-3">
// //               {capturedImage && (
// //                 <View className="relative">
// //                   <Image source={{ uri: capturedImage }} style={styles.thumbnail} className="rounded-lg" />
// //                   {isProcessing && (
// //                     <View style={styles.thumbnailOverlay}>
// //                       <ActivityIndicator size="small" color="#fff" />
// //                     </View>
// //                   )}
// //                 </View>
// //               )}

// //               <View className="flex-1">
// //                 <View className="flex-row items-center gap-2 mb-1">
// //                   <Text style={{ fontSize: 24 }}>{getEmotionEmoji(emotion.emotion)}</Text>
// //                   <Text className="text-base font-bold" style={{ color: getEmotionColor(emotion.emotion) }}>
// //                     {getEmotionLabel(emotion.emotion)}
// //                   </Text>
// //                 </View>

// //                 <View className="flex-row items-center gap-2">
// //                   <View className="h-2 flex-1 rounded-full bg-secondary overflow-hidden" style={{ maxWidth: 120 }}>
// //                     <View
// //                       className="h-full rounded-full"
// //                       style={{
// //                         width: `${emotion.confidence * 100}%`,
// //                         backgroundColor: getEmotionColor(emotion.emotion),
// //                       }}
// //                     />
// //                   </View>
// //                   <Text className="text-xs text-muted-foreground">{(emotion.confidence * 100).toFixed(0)}%</Text>
// //                 </View>
// //               </View>
// //             </Animated.View>
// //           )}

// //           {!emotion && (
// //             <View className="flex-row items-center gap-3 py-2">
// //               {isProcessing ? (
// //                 <>
// //                   <ActivityIndicator size="small" />
// //                   <Text className="text-sm text-muted-foreground">Analyzing your engagement…</Text>
// //                 </>
// //               ) : (
// //                 <>
// //                   <Camera size={16} className="text-muted-foreground" />
// //                   <Text className="text-sm text-muted-foreground">
// //                     {tflite.state !== 'loaded' ? 'Loading ML model…' : 'Detecting your learning engagement…'}
// //                   </Text>
// //                 </>
// //               )}
// //             </View>
// //           )}
// //         </View>
// //       </Card>
// //     </View>
// //   );
// // }

// // const styles = StyleSheet.create({
// //   thumbnail: {
// //     width: 60,
// //     height: 60,
// //     borderWidth: 2,
// //     borderColor: 'rgba(147, 51, 234, 0.3)',
// //   },
// //   thumbnailOverlay: {
// //     ...StyleSheet.absoluteFillObject,
// //     backgroundColor: 'rgba(0, 0, 0, 0.5)',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //     borderRadius: 8,
// //   },
// // });

// import React, { useState, useEffect, useRef, useMemo } from 'react';
// import { View, StyleSheet, ActivityIndicator, Dimensions, Image, Platform } from 'react-native';
// import { CameraView, useCameraPermissions } from 'expo-camera';
// import { Text } from '@/components/ui/text';
// import { Card } from '@/components/ui/card';
// import Animated, { FadeIn } from 'react-native-reanimated';
// import { Brain, Camera } from 'lucide-react-native';

// import { Buffer } from 'buffer';
// import jpeg from 'jpeg-js';

// // Test image - can be any size now
// const TEST_IMAGE = require('@/assets/images/test_image_224.jpeg');

// // Conditionally import TFLite only if the native module is available
// let useTensorflowModel: any = null;
// let isTfliteAvailable = false;

// try {
//   if (Platform.OS !== 'web') {
//     const tflite = require('react-native-fast-tflite');
//     useTensorflowModel = tflite.useTensorflowModel;
//     isTfliteAvailable = true;
//   }
// } catch (error) {
//   console.warn('TensorFlow Lite native module not available:', error);
//   isTfliteAvailable = false;
// }

// interface EmotionResult {
//   emotion: string;
//   confidence: number;
//   timestamp: Date;
// }

// interface TopicEmotionDetectorProps {
//   onEmotionDetected?: (emotion: string, confidence: number) => void;
// }

// // IMPORTANT: this order MUST match labels.txt that you saved.
// // Your Python does: class_names = sorted(list(set(labels)))
// // That means likely: ['bored','confused','drowsy','engaged','frustrated','looking_away']
// // Update this if your labels.txt differs.
// const EMOTIONS = ['bored', 'confused', 'drowsy', 'engaged', 'frustrated', 'looking_away'];

// const DETECTION_INTERVAL = 10000; // 10 seconds
// const { width: screenWidth } = Dimensions.get('window');

// function argMax(arr: ArrayLike<number>) {
//   let bestIdx = 0;
//   let bestVal = arr[0] ?? -Infinity;
//   for (let i = 1; i < arr.length; i++) {
//     const v = arr[i]!;
//     if (v > bestVal) {
//       bestVal = v;
//       bestIdx = i;
//     }
//   }
//   return { index: bestIdx, value: bestVal };
// }

// /**
//  * Read image bytes WITHOUT ImageManipulator (avoids display pipeline).
//  */
// async function readUriBytes(uri: string): Promise<Uint8Array> {
//   const res = await fetch(uri);
//   const ab = await res.arrayBuffer();
//   return new Uint8Array(ab);
// }

// /**
//  * Deterministic bilinear resize on RGBA (Uint8).
//  * Much closer to TF/Python numeric resize than ImageManipulator.
//  */
// function resizeBilinearRGBA(
//   src: Uint8Array,
//   srcW: number,
//   srcH: number,
//   dstW: number,
//   dstH: number
// ): Uint8Array {
//   if (srcW === dstW && srcH === dstH) return src;

//   const dst = new Uint8Array(dstW * dstH * 4);

//   const xScale = srcW / dstW;
//   const yScale = srcH / dstH;

//   for (let y = 0; y < dstH; y++) {
//     const sy = (y + 0.5) * yScale - 0.5;
//     const y0 = Math.max(0, Math.floor(sy));
//     const y1 = Math.min(srcH - 1, y0 + 1);
//     const wy = sy - y0;

//     for (let x = 0; x < dstW; x++) {
//       const sx = (x + 0.5) * xScale - 0.5;
//       const x0 = Math.max(0, Math.floor(sx));
//       const x1 = Math.min(srcW - 1, x0 + 1);
//       const wx = sx - x0;

//       const i00 = (y0 * srcW + x0) * 4;
//       const i10 = (y0 * srcW + x1) * 4;
//       const i01 = (y1 * srcW + x0) * 4;
//       const i11 = (y1 * srcW + x1) * 4;

//       const di = (y * dstW + x) * 4;

//       for (let c = 0; c < 4; c++) {
//         const v00 = src[i00 + c];
//         const v10 = src[i10 + c];
//         const v01 = src[i01 + c];
//         const v11 = src[i11 + c];

//         const v0 = v00 * (1 - wx) + v10 * wx;
//         const v1 = v01 * (1 - wx) + v11 * wx;
//         const v = v0 * (1 - wy) + v1 * wy;

//         dst[di + c] = Math.max(0, Math.min(255, Math.round(v)));
//       }
//     }
//   }

//   return dst;
// }

// /**
//  * Convert RGBA -> Float32 RGB in [-1, 1] exactly like:
//  * tf.keras.applications.mobilenet_v3.preprocess_input
//  *
//  * preprocess_input(x) = x/127.5 - 1.0  (expects x in [0..255])
//  */
// function rgbaToMobilenetV3FloatRGB(rgba: Uint8Array): Float32Array {
//   const out = new Float32Array((rgba.length / 4) * 3);
//   let j = 0;
//   for (let i = 0; i < rgba.length; i += 4) {
//     const r = rgba[i];
//     const g = rgba[i + 1];
//     const b = rgba[i + 2];

//     out[j++] = r / 127.5 - 1.0;
//     out[j++] = g / 127.5 - 1.0;
//     out[j++] = b / 127.5 - 1.0;
//   }
//   return out;
// }

// /**
//  * Full preprocessing: JPEG -> RGBA -> resize -> Float32 RGB [-1,1]
//  */
// async function photoToModelInput(uri: string, width: number, height: number) {
//   console.log('📷 Processing image URI:', uri);

//   const bytes = await readUriBytes(uri);

//   const decoded = jpeg.decode(Buffer.from(bytes), {
//     useTArray: true,
//     formatAsRGBA: true,
//   });

//   if (!decoded?.data) throw new Error('Failed to decode JPEG');

//   console.log('📷 Decoded JPEG dimensions:', decoded.width, 'x', decoded.height);

//   const resizedRgba = resizeBilinearRGBA(decoded.data, decoded.width, decoded.height, width, height);

//   const input = rgbaToMobilenetV3FloatRGB(resizedRgba);

//   // Debug stats (should be roughly -1..1)
//   let min = Infinity, max = -Infinity, sum = 0;
//   for (let i = 0; i < input.length; i++) {
//     const v = input[i];
//     if (v < min) min = v;
//     if (v > max) max = v;
//     sum += v;
//   }
//   console.log('📊 Input stats:', {
//     type: input.constructor.name,
//     length: input.length,
//     min,
//     max,
//     mean: (sum / input.length).toFixed(4),
//     first10: Array.from(input.slice(0, 10)),
//   });

//   return input;
// }

// export function TopicEmotionDetector({ onEmotionDetected }: TopicEmotionDetectorProps) {
//   const [permission, requestPermission] = useCameraPermissions();
//   const [emotion, setEmotion] = useState<EmotionResult | null>(null);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [countdown, setCountdown] = useState(DETECTION_INTERVAL / 1000);
//   const [capturedImage, setCapturedImage] = useState<string | null>(null);
//   const cameraRef = useRef<CameraView>(null);

//   const modelAsset = useMemo(
//     () => (isTfliteAvailable ? require('@/assets/model/engagement6_fp16.tflite') : null),
//     []
//   );

//   const tflite =
//     isTfliteAvailable && useTensorflowModel && modelAsset ? useTensorflowModel(modelAsset) : null;
//   const model = tflite?.state === 'loaded' ? tflite.model : undefined;

//   const INPUT_W = 224;
//   const INPUT_H = 224;

//   if (!isTfliteAvailable) {
//     return (
//       <Card className="mx-4 mb-4 border-yellow-500">
//         <View className="p-4">
//           <View className="flex-row items-center space-x-2 mb-2">
//             <Brain className="h-5 w-5 text-yellow-600" />
//             <Text className="font-semibold text-yellow-700">Emotion Detection Unavailable</Text>
//           </View>
//           <Text className="text-sm text-muted-foreground">
//             Emotion detection requires a development build with native modules. This feature is not available in Expo Go.
//           </Text>
//         </View>
//       </Card>
//     );
//   }

//   useEffect(() => {
//     const interval = setInterval(() => {
//       detectEmotion();
//       setCountdown(DETECTION_INTERVAL / 1000);
//     }, DETECTION_INTERVAL);

//     const initialTimeout = setTimeout(() => {
//       detectEmotion();
//     }, 2000);

//     return () => {
//       clearInterval(interval);
//       clearTimeout(initialTimeout);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [model]);

//   useEffect(() => {
//     const timer = setInterval(() => {
//       setCountdown((prev) => (prev <= 1 ? DETECTION_INTERVAL / 1000 : prev - 1));
//     }, 1000);

//     return () => clearInterval(timer);
//   }, []);

//   const detectEmotion = async () => {
//     if (isProcessing) return;
//     if (!model) return;

//     setIsProcessing(true);

//     try {
//       // Test image (replace later with camera photo uri)
//       const photo = { uri: Image.resolveAssetSource(TEST_IMAGE).uri };
//       setCapturedImage(photo.uri);

//       // ✅ Exact match to Python training preprocessing:
//       // decode -> resize -> float -> (x/127.5 - 1)
//       const inputTensor = await photoToModelInput(photo.uri, INPUT_W, INPUT_H);

//       const outputs = model.runSync([inputTensor]);
//       const probs = outputs[0] as Float32Array;

//       console.log('📊 Output probabilities:');
//       EMOTIONS.forEach((emo, i) => {
//         console.log(`   ${i}: ${emo} = ${(probs[i] * 100).toFixed(2)}%`);
//       });

//       const { index } = argMax(probs);
//       const predicted = EMOTIONS[index] ?? 'unknown';
//       const confidence = probs[index] ?? 0;

//       const result: EmotionResult = {
//         emotion: predicted,
//         confidence,
//         timestamp: new Date(),
//       };

//       setEmotion(result);
//       onEmotionDetected?.(result.emotion, result.confidence);

//       console.log(`🎯 Winner: ${predicted} ${(confidence * 100).toFixed(2)}%`);
//     } catch (error) {
//       console.error('Error detecting emotion:', error);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const getEmotionColor = (emotionName: string): string => {
//     const colors: Record<string, string> = {
//       engaged: '#4CAF50',
//       confused: '#FF9800',
//       frustrated: '#F44336',
//       drowsy: '#9C27B0',
//       bored: '#2196F3',
//       looking_away: '#607D8B',
//     };
//     return colors[emotionName] || '#999';
//   };

//   const getEmotionEmoji = (emotionName: string): string => {
//     const emojis: Record<string, string> = {
//       engaged: '😊',
//       confused: '😕',
//       frustrated: '😤',
//       drowsy: '😴',
//       bored: '😐',
//       looking_away: '👀',
//     };
//     return emojis[emotionName] || '😐';
//   };

//   const getEmotionLabel = (emotionName: string): string => {
//     const labels: Record<string, string> = {
//       engaged: 'Engaged',
//       confused: 'Confused',
//       frustrated: 'Frustrated',
//       drowsy: 'Drowsy',
//       bored: 'Bored',
//       looking_away: 'Distracted',
//     };
//     return labels[emotionName] || emotionName;
//   };

//   return (
//     <View className="mb-6">
//       <Card>
//         <View className="p-4">
//           <View className="flex-row items-center justify-between mb-3">
//             <View className="flex-row items-center gap-2">
//               <Brain size={18} className="text-purple-600 dark:text-purple-400" />
//               <Text className="text-sm font-semibold">Learning Engagement (Test Mode)</Text>
//             </View>

//             <View className="flex-row items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
//               <Camera size={14} className="text-foreground" />
//               <Text className="text-xs font-medium">
//                 {tflite.state !== 'loaded' ? 'Loading model…' : `Next: ${countdown}s`}
//               </Text>
//             </View>
//           </View>

//           {emotion && (
//             <Animated.View entering={FadeIn.duration(300)} className="flex-row items-center gap-3">
//               {capturedImage && (
//                 <View className="relative">
//                   <Image source={{ uri: capturedImage }} style={styles.thumbnail} className="rounded-lg" />
//                   {isProcessing && (
//                     <View style={styles.thumbnailOverlay}>
//                       <ActivityIndicator size="small" color="#fff" />
//                     </View>
//                   )}
//                 </View>
//               )}

//               <View className="flex-1">
//                 <View className="flex-row items-center gap-2 mb-1">
//                   <Text style={{ fontSize: 24 }}>{getEmotionEmoji(emotion.emotion)}</Text>
//                   <Text className="text-base font-bold" style={{ color: getEmotionColor(emotion.emotion) }}>
//                     {getEmotionLabel(emotion.emotion)}
//                   </Text>
//                 </View>

//                 <View className="flex-row items-center gap-2">
//                   <View className="h-2 flex-1 rounded-full bg-secondary overflow-hidden" style={{ maxWidth: 120 }}>
//                     <View
//                       className="h-full rounded-full"
//                       style={{
//                         width: `${emotion.confidence * 100}%`,
//                         backgroundColor: getEmotionColor(emotion.emotion),
//                       }}
//                     />
//                   </View>
//                   <Text className="text-xs text-muted-foreground">{(emotion.confidence * 100).toFixed(0)}%</Text>
//                 </View>
//               </View>
//             </Animated.View>
//           )}

//           {!emotion && (
//             <View className="flex-row items-center gap-3 py-2">
//               {isProcessing ? (
//                 <>
//                   <ActivityIndicator size="small" />
//                   <Text className="text-sm text-muted-foreground">Analyzing your engagement…</Text>
//                 </>
//               ) : (
//                 <>
//                   <Camera size={16} className="text-muted-foreground" />
//                   <Text className="text-sm text-muted-foreground">
//                     {tflite.state !== 'loaded' ? 'Loading ML model…' : 'Detecting your learning engagement…'}
//                   </Text>
//                 </>
//               )}
//             </View>
//           )}
//         </View>
//       </Card>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   thumbnail: {
//     width: 60,
//     height: 60,
//     borderWidth: 2,
//     borderColor: 'rgba(147, 51, 234, 0.3)',
//   },
//   thumbnailOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 8,
//   },
// });


// TopicEmotionDetector.tsx
// Live camera feed + VisionCamera + vision-camera-resize-plugin + fast-tflite
// Matches your Python training preprocessing:
//   tf.image.resize(img, (224,224))  -> STRETCH (no crop/letterbox)
//   mobilenet_v3.preprocess_input(x) -> x/127.5 - 1  (range [-1, 1])

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Image, Platform } from 'react-native';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Brain, Camera as CameraIcon } from 'lucide-react-native';

import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useSharedValue } from 'react-native-reanimated';

// Conditionally import TFLite only if the native module is available
let useTensorflowModel: any = null;
let isTfliteAvailable = false;

try {
  if (Platform.OS !== 'web') {
    const tflite = require('react-native-fast-tflite');
    useTensorflowModel = tflite.useTensorflowModel;
    isTfliteAvailable = true;
  }
} catch (error) {
  console.warn('TensorFlow Lite native module not available:', error);
  isTfliteAvailable = false;
}

interface EmotionResult {
  emotion: string;
  confidence: number;
  timestamp: Date;
}

interface TopicEmotionDetectorProps {
  onEmotionDetected?: (emotion: string, confidence: number) => void;
}

/**
 * IMPORTANT:
 * - Requires Dev Client (not Expo Go)
 * - Must install native deps:
 *   react-native-vision-camera
 *   vision-camera-resize-plugin
 *   react-native-fast-tflite
 */

// ✅ Replace with EXACT order from your exported labels.txt
// Your Python saves: class_names = sorted(list(set(labels)))
// Very likely: ['bored','confused','drowsy','engaged','frustrated','looking_away']
// If your labels.txt says "bored", DO NOT use "wbored".
const EMOTIONS = ['bored', 'confused', 'drowsy', 'engaged', 'frustrated', 'looking_away'];

const INPUT_W = 224;
const INPUT_H = 224;

// How often to run inference (keep it low; 3–8 FPS is plenty)
const INFER_FPS = 5;

function argMax(arr: ArrayLike<number>) {
  let bestIdx = 0;
  let bestVal = arr[0] ?? -Infinity;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i]!;
    if (v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return { index: bestIdx, value: bestVal };
}

export function TopicEmotionDetector({ onEmotionDetected }: TopicEmotionDetectorProps) {
  const [emotion, setEmotion] = useState<EmotionResult | null>(null);

  // Shared values for cross-thread communication (avoids serialization issues)
  const emotionIndex = useSharedValue(-1);
  const emotionConfidence = useSharedValue(0);

  // VisionCamera permission
  const { hasPermission, requestPermission } = useCameraPermission();

  // Choose camera: "front" or "back"
  const device = useCameraDevice('front');

  // Resize plugin (native)
  const { resize } = useResizePlugin();

  // TFLite model
  const modelAsset = useMemo(
    () => (isTfliteAvailable ? require('@/assets/model/engagement6_fp16.tflite') : null),
    []
  );
  const tflite =
    isTfliteAvailable && useTensorflowModel && modelAsset ? useTensorflowModel(modelAsset) : null;
  const model = tflite?.state === 'loaded' ? tflite.model : undefined;

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor shared values and update UI when they change
  useEffect(() => {
    const interval = setInterval(() => {
      const idx = emotionIndex.value;
      const conf = emotionConfidence.value;
      
      if (idx >= 0 && idx < EMOTIONS.length) {
        const predicted = EMOTIONS[idx];
        const result: EmotionResult = {
          emotion: predicted,
          confidence: conf,
          timestamp: new Date(),
        };
        setEmotion(result);
        onEmotionDetected?.(predicted, conf);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [emotionIndex, emotionConfidence, onEmotionDetected]);

  // Frame processor (runs off the JS thread)
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (!model) return;

      // 1) Resize + RGB float32 0..1 using plugin
      const rgb01 = resize(frame, {
        scale: { width: INPUT_W, height: INPUT_H },
        crop: { x: 0, y: 0, width: frame.width, height: frame.height },
        pixelFormat: 'rgb',
        dataType: 'float32',
      }) as Float32Array;

      // 2) MobileNetV3 preprocess_input: x*2 - 1 (converts 0..1 to -1..1)
      for (let i = 0; i < rgb01.length; i++) {
        rgb01[i] = rgb01[i] * 2.0 - 1.0;
      }

      // 3) Inference
      const outputs = model.runSync([rgb01]);
      const probs = outputs[0] as Float32Array;

      // 4) Argmax
      let bestIdx = 0;
      let bestVal = probs[0] ?? -Infinity;
      for (let i = 1; i < probs.length; i++) {
        const v = probs[i] as number;
        if (v > bestVal) {
          bestVal = v;
          bestIdx = i;
        }
      }

      // 5) Update shared values (no serialization needed!)
      emotionIndex.value = bestIdx;
      emotionConfidence.value = bestVal;
    },
    [model, emotionIndex, emotionConfidence]
  );

  if (!isTfliteAvailable) {
    return (
      <Card className="mx-4 mb-4 border-yellow-500">
        <View className="p-4">
          <View className="flex-row items-center space-x-2 mb-2">
            <Brain className="h-5 w-5 text-yellow-600" />
            <Text className="font-semibold text-yellow-700">Emotion Detection Unavailable</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            Emotion detection requires a development build with native modules. This feature is not available in Expo Go.
          </Text>
        </View>
      </Card>
    );
  }

  if (!device) {
    return (
      <Card className="mx-4 mb-4">
        <View className="p-4">
          <Text>Loading camera…</Text>
        </View>
      </Card>
    );
  }

  if (!hasPermission) {
    return (
      <Card className="mx-4 mb-4">
        <View className="p-4">
          <Text>Camera permission required.</Text>
          <Text className="text-sm text-muted-foreground">Please grant camera access and reopen.</Text>
        </View>
      </Card>
    );
  }

  const getEmotionColor = (emotionName: string): string => {
    const colors: Record<string, string> = {
      engaged: '#4CAF50',
      confused: '#FF9800',
      frustrated: '#F44336',
      drowsy: '#9C27B0',
      bored: '#2196F3',
      looking_away: '#607D8B',
    };
    return colors[emotionName] || '#999';
  };

  const getEmotionEmoji = (emotionName: string): string => {
    const emojis: Record<string, string> = {
      engaged: '😊',
      confused: '😕',
      frustrated: '😤',
      drowsy: '😴',
      bored: '😐',
      looking_away: '👀',
    };
    return emojis[emotionName] || '😐';
  };

  const getEmotionLabel = (emotionName: string): string => {
    const labels: Record<string, string> = {
      engaged: 'Engaged',
      confused: 'Confused',
      frustrated: 'Frustrated',
      drowsy: 'Drowsy',
      bored: 'Bored',
      looking_away: 'Distracted',
    };
    return labels[emotionName] || emotionName;
  };

  return (
    <View className="mb-6">
      <Card>
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Brain size={18} className="text-purple-600 dark:text-purple-400" />
              <Text className="text-sm font-semibold">Learning Engagement (Live Camera)</Text>
            </View>

            <View className="flex-row items-center gap-2 bg-secondary px-3 py-1.5 rounded-full">
              <CameraIcon size={14} className="text-foreground" />
              <Text className="text-xs font-medium">
                {tflite?.state !== 'loaded' ? 'Loading model…' : `Running @ ${INFER_FPS} FPS`}
              </Text>
            </View>
          </View>

          {/* Camera preview */}
          <View style={styles.previewWrap}>
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              frameProcessor={frameProcessor}
              frameProcessorFps={INFER_FPS}
              pixelFormat="yuv"
            />
          </View>

          {/* Result */}
          {emotion ? (
            <Animated.View entering={FadeIn.duration(200)} className="flex-row items-center gap-3 mt-4">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text style={{ fontSize: 24 }}>{getEmotionEmoji(emotion.emotion)}</Text>
                  <Text className="text-base font-bold" style={{ color: getEmotionColor(emotion.emotion) }}>
                    {getEmotionLabel(emotion.emotion)}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <View className="h-2 flex-1 rounded-full bg-secondary overflow-hidden" style={{ maxWidth: 160 }}>
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(1, emotion.confidence)) * 100}%`,
                        backgroundColor: getEmotionColor(emotion.emotion),
                      }}
                    />
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {(emotion.confidence * 100).toFixed(0)}%
                  </Text>
                </View>

                <Text className="text-xs text-muted-foreground mt-1">
                  {emotion.timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <View className="flex-row items-center gap-3 py-2 mt-3">
              {tflite?.state !== 'loaded' ? (
                <>
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Loading ML model…</Text>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" />
                  <Text className="text-sm text-muted-foreground">Analyzing…</Text>
                </>
              )}
            </View>
          )}

          {/* Hint */}
          <Text className="text-xs text-muted-foreground mt-3">
            Tip: If results look flipped/mismatched on the front camera, switch device to back camera or add a horizontal flip.
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    width: '100%',
    aspectRatio: 1, // square preview, easier for mental mapping
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.25)',
    backgroundColor: '#111',
  },
});

