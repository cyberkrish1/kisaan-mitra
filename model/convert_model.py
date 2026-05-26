import tensorflow as tf

# Load old model
model = tf.keras.models.load_model("plant_model.h5", compile=False)

# Save in new Keras format
model.save("plant_model.keras")

print("Model converted successfully!")