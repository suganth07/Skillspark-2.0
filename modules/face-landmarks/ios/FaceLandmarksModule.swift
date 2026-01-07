import ExpoModulesCore
import UIKit
import MediaPipeTasksVision

public class FaceLandmarksModule: Module {
    
    private var landmarker: FaceLandmarker?
    
    public func definition() -> ModuleDefinition {
        Name("FaceLandmarks")
        
        AsyncFunction("detectFromImageAsync") { (uri: String, promise: Promise) in
            do {
                try self.ensureInit()
                
                // Load image from URI
                guard let url = URL(string: uri) else {
                    throw NSError(domain: "FaceLandmarks", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid URI: \(uri)"])
                }
                
                let image: UIImage
                if url.scheme == "file" || uri.hasPrefix("/") {
                    // Local file path
                    let path = url.scheme == "file" ? url.path : uri
                    guard let loadedImage = UIImage(contentsOfFile: path) else {
                        throw NSError(domain: "FaceLandmarks", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not load image from path: \(path)"])
                    }
                    image = loadedImage
                } else {
                    // Remote or content URI - load data
                    let data = try Data(contentsOf: url)
                    guard let loadedImage = UIImage(data: data) else {
                        throw NSError(domain: "FaceLandmarks", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not decode image data from URI: \(uri)"])
                    }
                    image = loadedImage
                }
                
                let mpImage = try MPImage(uiImage: image)
                let result = try self.landmarker!.detect(image: mpImage)
                
                guard let face = result.faceLandmarks.first else {
                    // No face detected
                    promise.resolve([
                        "width": Int(image.size.width),
                        "height": Int(image.size.height),
                        "landmarks": [] as [[String: Any]]
                    ])
                    return
                }
                
                // MediaPipe Face Landmarker returns 478 landmarks (468 face mesh + 10 iris)
                // We return all of them - the first 468 are compatible with the Python logic
                let landmarks: [[String: Any]] = face.map { lm in
                    [
                        "x": Double(lm.x),
                        "y": Double(lm.y),
                        "z": Double(lm.z)
                    ]
                }
                
                promise.resolve([
                    "width": Int(image.size.width),
                    "height": Int(image.size.height),
                    "landmarks": landmarks
                ])
            } catch {
                promise.reject("FACE_DETECTION_ERROR", error.localizedDescription)
            }
        }
    }
    
    private func ensureInit() throws {
        if landmarker != nil { return }
        
        guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task") else {
            throw NSError(domain: "FaceLandmarks", code: 4, userInfo: [NSLocalizedDescriptionKey: "Could not find face_landmarker.task in bundle"])
        }
        
        let baseOptions = BaseOptions(modelAssetPath: modelPath)
        
        let options = FaceLandmarkerOptions()
        options.baseOptions = baseOptions
        options.runningMode = .image
        options.numFaces = 1
        options.minFaceDetectionConfidence = 0.5
        options.minFacePresenceConfidence = 0.5
        options.minTrackingConfidence = 0.5
        options.outputFaceBlendshapes = false
        options.outputFacialTransformationMatrixes = false
        
        landmarker = try FaceLandmarker(options: options)
    }
}
