"""Disease classifier service (Hugging Face computer-vision model).

The model loads in a background thread at startup so the API boots
instantly. When a stronger model or a self-hosted vision service is
adopted, only this module changes — routers and intelligence services
keep the same contract.
"""

from __future__ import annotations

import logging
import threading

from app.core.config import get_settings

logger = logging.getLogger("terramind.disease")

settings = get_settings()


class DiseaseClassifier:
    """Thin wrapper around a HF image-classification model."""

    def __init__(self) -> None:
        self.model_name = settings.disease_model_name
        self.enabled = settings.disease_model_enabled
        self.processor = None
        self.model = None
        self.device = "cpu"
        self.loaded = False
        self.error: str | None = None
        self._lock = threading.Lock()
        self._load_attempted = False

    # ------------------------------------------------------------------
    def load_async(self) -> None:
        """Kick off background loading (called at app startup)."""
        if not self.enabled or self._load_attempted:
            return
        self._load_attempted = True
        thread = threading.Thread(target=self._load, daemon=True)
        thread.start()

    def _load(self) -> None:
        with self._lock:
            try:
                import torch
                from transformers import AutoModelForImageClassification

                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(
                    "Loading disease model %s on %s...", self.model_name, self.device
                )
                self.processor = self._load_processor()
                self.model = AutoModelForImageClassification.from_pretrained(
                    self.model_name
                )
                self.model.to(self.device)
                self.model.eval()
                self.loaded = True
                self.error = None
                logger.info("Disease model loaded successfully.")
            except Exception as exc:  # pragma: no cover - depends on network
                self.loaded = False
                self.error = str(exc)
                logger.exception("Disease model failed to load.")

    def _load_processor(self):
        """Resolve the image processor, tolerating legacy model repos.

        Older repos (like our ResNet50) declare deprecated classes such
        as `ConvNextFeatureExtractor` that transformers 5.x no longer
        maps through AutoImageProcessor; the modern ConvNextImageProcessor
        reads the identical config.
        """
        from transformers import AutoImageProcessor, ConvNextImageProcessor

        try:
            return AutoImageProcessor.from_pretrained(self.model_name)
        except ValueError:
            return ConvNextImageProcessor.from_pretrained(self.model_name)

    # ------------------------------------------------------------------
    def ensure_loaded(self) -> None:
        """Load synchronously if the background load has not run yet."""
        if not self.loaded and not self._load_attempted:
            self._load()
        elif not self.loaded and self.error is None:
            # Background load still in flight — wait briefly.
            with self._lock:
                pass

    def classify(self, image) -> list[dict]:  # noqa: ANN001 (PIL.Image)
        """Return top-3 predictions: [{label, crop, disease, confidence}]."""
        self.ensure_loaded()
        if not self.loaded or self.model is None or self.processor is None:
            from app.core.errors import APIError
            from fastapi import status

            raise APIError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "model_unavailable",
                "The disease-detection model is not available. "
                f"Detail: {self.error or 'still loading'}",
            )

        import torch

        from app.services.disease.knowledge import parse_label

        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            probabilities = torch.softmax(outputs.logits, dim=-1)
            top_k = min(3, probabilities.shape[-1])
            top_values, top_indices = torch.topk(probabilities, k=top_k, dim=-1)

        predictions: list[dict] = []
        for score, index in zip(top_values[0], top_indices[0], strict=False):
            label = self.model.config.id2label[int(index.item())]
            confidence = float(score.item()) * 100.0
            parsed = parse_label(label)
            predictions.append(
                {
                    "label": parsed["raw"],
                    "crop": parsed["crop"],
                    "disease": parsed["disease"],
                    "confidence": round(confidence, 2),
                }
            )
        return predictions

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "loaded": self.loaded,
            "model_name": self.model_name,
            "device": self.device,
            "error": self.error,
        }


disease_classifier = DiseaseClassifier()
