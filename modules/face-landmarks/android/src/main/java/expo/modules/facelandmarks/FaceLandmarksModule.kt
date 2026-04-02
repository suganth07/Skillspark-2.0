package expo.modules.facelandmarks

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.net.URL

class FaceLandmarksModule : Module() {
  private var landmarker: FaceLandmarker? = null

  override fun definition() = ModuleDefinition {
    Name("FaceLandmarks")

    AsyncFunction("detectFromImageAsync") { uri: String, promise: Promise ->
      try {
        ensureInit()

        val imageBytes = readImageBytes(uri)
        val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
          ?: throw IllegalArgumentException("Could not decode image from URI: $uri")

        val uprightBitmap = rotateBitmapIfNeeded(bitmap, imageBytes)
        val mpImage = BitmapImageBuilder(uprightBitmap).build()
        val result = landmarker!!.detect(mpImage)

        val faces = result.faceLandmarks()
        if (faces.isEmpty()) {
          promise.resolve(
            mapOf(
              "width" to uprightBitmap.width,
              "height" to uprightBitmap.height,
              "landmarks" to emptyList<Map<String, Double>>()
            )
          )
          return@AsyncFunction
        }

        val landmarks = faces[0].map { landmark ->
          mapOf(
            "x" to landmark.x().toDouble(),
            "y" to landmark.y().toDouble(),
            "z" to landmark.z().toDouble()
          )
        }

        promise.resolve(
          mapOf(
            "width" to uprightBitmap.width,
            "height" to uprightBitmap.height,
            "landmarks" to landmarks
          )
        )
      } catch (e: Exception) {
        promise.reject("FACE_DETECTION_ERROR", e.message ?: "Unknown face detection error", e)
      }
    }
  }

  private fun ensureInit() {
    if (landmarker != null) return

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("face_landmarker.task")
      .build()

    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.IMAGE)
      .setNumFaces(1)
      .setMinFaceDetectionConfidence(0.5f)
      .setMinFacePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()

    landmarker = FaceLandmarker.createFromOptions(appContext.reactContext ?: appContext.throwingActivity, options)
  }

  private fun readImageBytes(uriString: String): ByteArray {
    if (uriString.startsWith("http://") || uriString.startsWith("https://")) {
      return URL(uriString).openStream().use { it.readBytes() }
    }

    val parsedUri = Uri.parse(uriString)
    val scheme = parsedUri.scheme

    if (scheme == "content" || scheme == "file") {
      val resolver = appContext.reactContext?.contentResolver
      return resolver?.openInputStream(parsedUri)?.use { it.readBytes() }
        ?: throw IllegalArgumentException("Could not open image URI: $uriString")
    }

    val filePath = if (scheme == null) uriString else parsedUri.path
    val file = File(filePath ?: throw IllegalArgumentException("Invalid file path: $uriString"))
    if (!file.exists()) {
      throw IllegalArgumentException("Image file does not exist: $uriString")
    }

    return FileInputStream(file).use { it.readBytes() }
  }

  private fun rotateBitmapIfNeeded(bitmap: Bitmap, imageBytes: ByteArray): Bitmap {
    val exif = ExifInterface(ByteArrayInputStream(imageBytes))
    val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)

    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      else -> return bitmap
    }

    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }
}
