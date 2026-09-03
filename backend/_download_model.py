"""Build-time helper: bake the disease-model weights into the image.

Downloads the processor and model for the configured model into HF_HOME
so the production container can run fully offline (HF_HUB_OFFLINE=1).
Mirrors the load path in app/services/disease/classifier.py exactly.
"""

import os

from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    ConvNextImageProcessor,
)

MODEL_NAME = "mesabo/agri-plant-disease-resnet50"

if __name__ == "__main__":
    try:
        processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    except ValueError:
        # Legacy repos (our ResNet50) declare deprecated feature-extractor
        # classes; the modern ConvNextImageProcessor reads the same config.
        processor = ConvNextImageProcessor.from_pretrained(MODEL_NAME)
    print(f"processor cached: {type(processor).__name__}")

    model = AutoModelForImageClassification.from_pretrained(MODEL_NAME)
    params_m = sum(p.numel() for p in model.parameters()) / 1e6
    print(f"model cached: {type(model).__name__} ({params_m:.1f}M parameters)")
    print(f"cached under HF_HOME={os.environ.get('HF_HOME')}")
