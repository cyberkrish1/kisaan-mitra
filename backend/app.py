# backend/app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import json, io, os

app = Flask(__name__)
CORS(app)   # allows your HTML frontend to call this API

# ── Load model once at startup ──────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "plant_model.h5")
)

CLASS_NAMES_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "class_names.json")
)

print("MODEL PATH:", MODEL_PATH)
print("CLASS PATH:", CLASS_NAMES_PATH)
print("MODEL EXISTS:", os.path.exists(MODEL_PATH))
print("CLASS EXISTS:", os.path.exists(CLASS_NAMES_PATH))

print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH)

with open(CLASS_NAMES_PATH, "r") as f:
    class_names = json.load(f)   # { "0": "Apple___Apple_scab", "1": "Apple___Black_rot", ... }

print(f"Model loaded. {len(class_names)} classes available.")
# ───────────────────────────────────────────────────────

# Disease treatment info — add more as needed
TREATMENT_INFO = {
    "Apple___Apple_scab":         "Apply fungicide sprays. Remove and destroy infected leaves. Ensure good air circulation.",
    "Apple___Black_rot":          "Prune infected branches. Apply copper-based fungicide. Remove mummified fruits.",
    "Tomato___Early_blight":      "Remove infected lower leaves. Apply fungicide (chlorothalonil). Avoid overhead watering.",
    "Tomato___Late_blight":       "Apply copper fungicide immediately. Remove infected plants. Improve drainage.",
    "Tomato___Leaf_Mold":         "Increase air circulation. Reduce humidity. Apply fungicide if severe.",
    "Potato___Early_blight":      "Apply fungicide early. Practice crop rotation. Remove dead plant material.",
    "Potato___Late_blight":       "Destroy infected plants immediately. Apply fungicide preventively. Avoid wet conditions.",
    "Corn___Common_rust":         "Plant resistant varieties. Apply fungicide at first sign. Remove infected debris.",
    "healthy":                    "Your plant looks healthy! Continue regular watering, fertilizing, and monitoring.",
}

def preprocess_image(image_bytes):
    """Convert uploaded image bytes into a model-ready tensor."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32) / 255.0   # normalize to [0, 1]
    img_array = np.expand_dims(img_array, axis=0)          # shape: (1, 224, 224, 3)
    return img_array

def get_treatment(class_name):
    """Look up treatment advice. Falls back to generic message."""
    for key in TREATMENT_INFO:
        if key.lower() in class_name.lower():
            return TREATMENT_INFO[key]
    if "healthy" in class_name.lower():
        return TREATMENT_INFO["healthy"]
    return "Consult a local agricultural expert for treatment advice specific to your region."

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Plant Disease Detection API is running", "classes": len(class_names)})

@app.route("/predict", methods=["POST"])
def predict():
    # Check image was sent
    if "image" not in request.files:
        return jsonify({"error": "No image file provided. Send image as form-data with key 'image'."}), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({"error": "Empty filename. Please select an image."}), 400

    try:
        image_bytes = file.read()
        img_tensor  = preprocess_image(image_bytes)

        # Run prediction
        predictions = model.predict(img_tensor)[0]   # shape: (NUM_CLASSES,)

        # Top prediction
        top_idx        = int(np.argmax(predictions))
        top_class      = class_names[str(top_idx)]
        top_confidence = float(predictions[top_idx]) * 100

        # Top 3 predictions for display
        top3_idx = np.argsort(predictions)[::-1][:3]
        top3 = [
            {
                "class":      class_names[str(i)],
                "confidence": round(float(predictions[i]) * 100, 2)
            }
            for i in top3_idx
        ]

        # Clean up class name for display (e.g. "Tomato___Early_blight" → "Tomato — Early blight")
        parts        = top_class.split("___")
        plant_name   = parts[0].replace("_", " ")
        disease_name = parts[1].replace("_", " ") if len(parts) > 1 else "Unknown"
        is_healthy   = "healthy" in top_class.lower()

        return jsonify({
            "plant":      plant_name,
            "disease":    disease_name,
            "is_healthy": is_healthy,
            "confidence": round(top_confidence, 2),
            "treatment":  get_treatment(top_class),
            "top3":       top3,
            "raw_class":  top_class
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)