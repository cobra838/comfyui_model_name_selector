"""ComfyUI node for model selection with filtering and auto-control."""

import random
from typing import Tuple, Dict, Any

from .model_manager import ModelManager


class ModelNameSelector:
    """Node for selecting models with type/folder filtering and increment/decrement control."""
    
    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Any]:
        all_subfolders = ["All"]
        models = ModelManager.get_models_by_type("All")
        
        for model in models:
            if '\\' in model or '/' in model:
                sep = '\\' if '\\' in model else '/'
                parts = model.split(sep)
                if len(parts) > 2:
                    all_subfolders.append(parts[1])
        
        all_subfolders = sorted(list(set(all_subfolders)), key=lambda x: x == "All")
        
        return {
            "required": {
                "model_type": (["All", "Checkpoints", "Diffusion Models", "GGUF"],),
                "folder": (ModelManager.get_folders("All"),),
                "subfolder": (all_subfolders,),
                "model_name": (ModelManager.get_models("All", "All", "All"),),
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
            }
        }
    
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("model_name",)
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True
    
    def get_name(
        self, 
        model_type: str, 
        folder: str, 
        subfolder: str, 
        model_name: str, 
        control_after_generate: str
    ) -> Dict[str, Any]:
        """Execute model selection with optional auto-control."""
        models = ModelManager.get_models(model_type, folder, subfolder)
        
        if models == ["No models found"]:
            return {"ui": {"model_name": [model_name]}, "result": (model_name,)}
        
        if model_name not in models:
            model_name = models[0]
        
        selected = self._apply_control(model_name, models, control_after_generate)
        
        return {"ui": {"model_name": [selected]}, "result": (selected,)}
    
    def _apply_control(self, model_name: str, models: list, control: str) -> str:
        """Apply control logic (increment/decrement/randomize)."""
        if control == "fixed":
            return model_name
        
        idx = models.index(model_name)
        
        if control == "increment":
            return self._increment(idx, models, model_name)
        elif control == "decrement":
            return self._decrement(idx, models, model_name)
        elif control == "randomize":
            return self._randomize(model_name, models)
        
        return model_name
    
    def _increment(self, idx: int, models: list, current: str) -> str:
        """Increment to next model, raise error at end."""
        if idx < len(models) - 1:
            return models[idx + 1]
        raise ValueError(f"Reached end of model list (last model: {current})")
    
    def _decrement(self, idx: int, models: list, current: str) -> str:
        """Decrement to previous model, raise error at start."""
        if idx > 0:
            return models[idx - 1]
        raise ValueError(f"Reached start of model list (first model: {current})")
    
    def _randomize(self, current: str, models: list) -> str:
        """Select random model different from current."""
        if len(models) <= 1:
            return models[0]
        
        other_models = [m for m in models if m != current]
        return random.choice(other_models)


NODE_CLASS_MAPPINGS = {"ModelNameSelector": ModelNameSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"ModelNameSelector": "Model Name Selector"}