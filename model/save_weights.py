import tensorflow as tf

model = tf.keras.models.load_model(
    "final_model.keras",
    compile=False
)

model.save_weights("plant_weights.weights.h5")

print("Weights saved!")