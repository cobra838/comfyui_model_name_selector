import folder_paths
import random

class ModelNameSelector:
    
    @classmethod
    def INPUT_TYPES(s):
        models = folder_paths.get_filename_list("checkpoints")
        models += folder_paths.get_filename_list("diffusion_models")
        models += folder_paths.get_filename_list("unet")
        
        return {
            "required": {
                "model_name": (sorted(models),),
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
            }
        }
    
    RETURN_TYPES = ("STRING", "*")
    RETURN_NAMES = ("model_name_string", "model_name_combo")
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True
    
    def get_name(self, model_name, control_after_generate):
        models = folder_paths.get_filename_list("checkpoints")
        models += folder_paths.get_filename_list("diffusion_models")
        models += folder_paths.get_filename_list("unet")
        models = sorted(models)
        
        if not models:
            return {"ui": {"model_name": [model_name]}, "result": (model_name, model_name)}
        
        selected = model_name
        
        if control_after_generate != "fixed":
            idx = models.index(model_name) if model_name in models else 0
            
            if control_after_generate == "increment":
                selected = models[(idx + 1) % len(models)]
            elif control_after_generate == "decrement":
                selected = models[(idx - 1) % len(models)]
            elif control_after_generate == "randomize":
                selected = random.choice(models)
        
        return {"ui": {"model_name": [selected]}, "result": (selected, selected)}

NODE_CLASS_MAPPINGS = {"ModelNameSelector": ModelNameSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"ModelNameSelector": "Model Name Selector"}
WEB_DIRECTORY = "./js"