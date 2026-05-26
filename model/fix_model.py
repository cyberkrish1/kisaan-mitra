import tensorflow as tf

print("TensorFlow Version:", tf.__version__)

model = tf.keras.models.load_model(
    "plant_model.keras",
    compile=False
)

model.save("final_model.keras")

print("Model saved successfully!")