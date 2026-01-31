import folder_paths
import random
import os

class ModelNameSelector:
    
    @classmethod
    def INPUT_TYPES(s):
        models = []
        models += folder_paths.get_filename_list("checkpoints")
        models += folder_paths.get_filename_list("diffusion_models")
        models += folder_paths.get_filename_list("unet")
        
        return {
            "required": {
                "model_name": (sorted(models),),
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            }
        }
    
    RETURN_TYPES = ("STRING", "*")
    RETURN_NAMES = ("model_name_string", "model_name_combo")
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True  # Важно: это позволяет узлу обновляться после генерации
    
    def get_name(self, model_name, control_after_generate, unique_id=None, extra_pnginfo=None):
        models = []
        models += folder_paths.get_filename_list("checkpoints")
        models += folder_paths.get_filename_list("diffusion_models")
        models += folder_paths.get_filename_list("unet")
        models = sorted(models)
        
        if len(models) == 0:
            return (model_name, model_name)
        
        print(f"[ModelNameSelector] Current: {model_name}")
        print(f"[ModelNameSelector] Control: {control_after_generate}")
        
        selected = model_name
        
        if control_after_generate == "increment":
            idx = models.index(model_name) if model_name in models else 0
            selected = models[(idx + 1) % len(models)]
            print(f"[ModelNameSelector] INCREMENT -> {selected}")
        elif control_after_generate == "decrement":
            idx = models.index(model_name) if model_name in models else 0
            selected = models[(idx - 1) % len(models)]
            print(f"[ModelNameSelector] DECREMENT -> {selected}")
        elif control_after_generate == "randomize":
            selected = random.choice(models)
            print(f"[ModelNameSelector] RANDOMIZE -> {selected}")
        
        # Обновляем extra_pnginfo для следующего запуска
        if extra_pnginfo is not None and unique_id is not None:
            if isinstance(extra_pnginfo, list) and len(extra_pnginfo) > 0:
                if "workflow" in extra_pnginfo[0]:
                    workflow = extra_pnginfo[0]["workflow"]
                    node = next((n for n in workflow["nodes"] if str(n["id"]) == str(unique_id)), None)
                    if node and "widgets_values" in node:
                        # Обновляем значение в workflow
                        node["widgets_values"][0] = selected
        
        return {
            "ui": {"model_name": [selected]},
            "result": (selected, selected)
        }

NODE_CLASS_MAPPINGS = {
    "ModelNameSelector": ModelNameSelector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModelNameSelector": "Model Name Selector"
}

WEB_DIRECTORY = "./js"