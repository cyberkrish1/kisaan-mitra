from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
import numpy as np
from PIL import Image
import json
import io
import os

tf.get_logger().setLevel('ERROR')

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

WEIGHTS_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "plant_weights.weights.h5")
)

CLASS_NAMES_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "model", "class_names.json")
)

print("WEIGHTS EXISTS:", os.path.exists(WEIGHTS_PATH))
print("CLASS EXISTS:", os.path.exists(CLASS_NAMES_PATH))

# LOAD CLASS NAMES
with open(CLASS_NAMES_PATH, "r") as f:
    class_names = json.load(f)

NUM_CLASSES = len(class_names)

# REBUILD MODEL ARCHITECTURE
base_model = MobileNetV2(
    weights=None,
    include_top=False,
    input_shape=(224, 224, 3)
)

base_model.trainable = False

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation='relu')(x)
x = Dropout(0.3)(x)

output = Dense(NUM_CLASSES, activation='softmax')(x)

model = Model(inputs=base_model.input, outputs=output)

# LOAD WEIGHTS
model.load_weights(WEIGHTS_PATH)

print("✅ Model loaded successfully!")

TREATMENT_INFO = {
    "healthy":
        "Your plant looks healthy!"
}

def preprocess_image(image_bytes):

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    img = img.resize((224, 224))

    img_array = np.array(img, dtype=np.float32) / 255.0

    img_array = np.expand_dims(img_array, axis=0)

    return img_array

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "Plant Disease Detection API is running",
        "classes": len(class_names)
    })

@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return jsonify({
            "error": "No image uploaded"
        }), 400

    try:

        file = request.files["image"]

        image_bytes = file.read()

        img_tensor = preprocess_image(image_bytes)

        predictions = model.predict(img_tensor)[0]

        top_idx = int(np.argmax(predictions))

        top_class = class_names[str(top_idx)]

        confidence = float(predictions[top_idx]) * 100

        parts = top_class.split("___")

        plant_name = parts[0].replace("_", " ")

        disease_name = (
            parts[1].replace("_", " ")
            if len(parts) > 1
            else "Unknown"
        )

        return jsonify({
            "plant": plant_name,
            "disease": disease_name,
            "confidence": round(confidence, 2),
            "raw_class": top_class
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port
    )