from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import json
import io
import os

# Reduce TensorFlow logs
tf.get_logger().setLevel('ERROR')

app = Flask(__name__)
CORS(app)

# =========================================================
# PATH SETUP
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "plant_model.h5")
)

CLASS_NAMES_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "class_names.json")
)

print("===================================")
print("MODEL PATH:", MODEL_PATH)
print("CLASS PATH:", CLASS_NAMES_PATH)
print("MODEL EXISTS:", os.path.exists(MODEL_PATH))
print("CLASS EXISTS:", os.path.exists(CLASS_NAMES_PATH))
print("===================================")

# =========================================================
# LOAD MODEL
# =========================================================

try:
    print("Loading TensorFlow model...")

    model = tf.keras.models.load_model(
        MODEL_PATH,
        compile=False
    )

    print("✅ Model loaded successfully!")

except Exception as e:
    print("❌ ERROR LOADING MODEL:", str(e))
    raise e

# =========================================================
# LOAD CLASS NAMES
# =========================================================

try:
    with open(CLASS_NAMES_PATH, "r") as f:
        class_names = json.load(f)

    print(f"✅ Loaded {len(class_names)} classes")

except Exception as e:
    print("❌ ERROR LOADING CLASS NAMES:", str(e))
    raise e

# =========================================================
# TREATMENT DATABASE
# =========================================================

TREATMENT_INFO = {
    "Apple___Apple_scab":
        "Apply fungicide sprays. Remove infected leaves and improve air circulation.",

    "Apple___Black_rot":
        "Prune infected branches and apply copper-based fungicide.",

    "Tomato___Early_blight":
        "Remove infected leaves and apply chlorothalonil fungicide.",

    "Tomato___Late_blight":
        "Apply copper fungicide immediately and improve drainage.",

    "Tomato___Leaf_Mold":
        "Reduce humidity and increase air circulation.",

    "Potato___Early_blight":
        "Apply fungicide and practice crop rotation.",

    "Potato___Late_blight":
        "Destroy infected plants and avoid wet conditions.",

    "Corn___Common_rust":
        "Plant resistant varieties and apply fungicide early.",

    "healthy":
        "Your plant looks healthy! Continue proper watering and monitoring."
}

# =========================================================
# IMAGE PREPROCESSING
# =========================================================

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    img = img.resize((224, 224))

    img_array = np.array(img, dtype=np.float32) / 255.0

    img_array = np.expand_dims(img_array, axis=0)

    return img_array

# =========================================================
# TREATMENT HELPER
# =========================================================

def get_treatment(class_name):

    for key in TREATMENT_INFO:

        if key.lower() in class_name.lower():
            return TREATMENT_INFO[key]

    if "healthy" in class_name.lower():
        return TREATMENT_INFO["healthy"]

    return (
        "Consult a local agricultural expert "
        "for treatment advice specific to your region."
    )

# =========================================================
# HOME ROUTE
# =========================================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "Plant Disease Detection API is running",
        "classes": len(class_names),
        "status": "success"
    })

# =========================================================
# PREDICTION ROUTE
# =========================================================

@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return jsonify({
            "error": "No image uploaded"
        }), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({
            "error": "Empty filename"
        }), 400

    try:
        image_bytes = file.read()

        img_tensor = preprocess_image(image_bytes)

        predictions = model.predict(img_tensor)[0]

        top_idx = int(np.argmax(predictions))

        top_class = class_names[str(top_idx)]

        top_confidence = float(predictions[top_idx]) * 100

        # Top 3 predictions
        top3_idx = np.argsort(predictions)[::-1][:3]

        top3 = []

        for i in top3_idx:
            top3.append({
                "class": class_names[str(i)],
                "confidence": round(float(predictions[i]) * 100, 2)
            })

        # Format names
        parts = top_class.split("___")

        plant_name = parts[0].replace("_", " ")

        disease_name = (
            parts[1].replace("_", " ")
            if len(parts) > 1
            else "Unknown"
        )

        is_healthy = "healthy" in top_class.lower()

        return jsonify({
            "plant": plant_name,
            "disease": disease_name,
            "is_healthy": is_healthy,
            "confidence": round(top_confidence, 2),
            "treatment": get_treatment(top_class),
            "top3": top3,
            "raw_class": top_class
        })

    except Exception as e:

        print("❌ Prediction Error:", str(e))

        return jsonify({
            "error": str(e)
        }), 500

# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    print(f"🚀 Starting server on port {port}")

    app.run(
        host="0.0.0.0",
        port=port
    )