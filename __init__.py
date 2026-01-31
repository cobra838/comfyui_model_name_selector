import folder_paths
import random

class ModelNameSelector:
    
    @classmethod
    def INPUT_TYPES(s):
        # Start with all models for validation
        all_models = s.get_models("All")
        
        return {
            "required": {
                "model_type": (["All", "Checkpoints", "Diffusion Models", "GGUF"],),
                "model_name": (all_models,),
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
            }
        }
    
    @classmethod
    def get_models(s, model_type):
        models = []
        if model_type in ["All", "Checkpoints"]:
            models += folder_paths.get_filename_list("checkpoints")
        if model_type in ["All", "Diffusion Models"]:
            models += folder_paths.get_filename_list("diffusion_models")
        if model_type in ["All", "GGUF"]:
            models += folder_paths.get_filename_list("unet_gguf")
        return sorted(models) if models else ["No models found"]
    
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("model_name",)
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True
    
    def get_name(self, model_type, model_name, control_after_generate):
        models = self.get_models(model_type)
        
        if models == ["No models found"]:
            return {"ui": {"model_name": [model_name]}, "result": (model_name,)}
        
        selected = model_name
        
        if control_after_generate != "fixed":
            idx = models.index(model_name) if model_name in models else 0
            
            if control_after_generate == "increment":
                selected = models[(idx + 1) % len(models)]
            elif control_after_generate == "decrement":
                selected = models[(idx - 1) % len(models)]
            elif control_after_generate == "randomize":
                selected = random.choice(models)
        
        return {"ui": {"model_name": [selected]}, "result": (selected,)}

# API endpoint for getting models by type
import server
from aiohttp import web

@server.PromptServer.instance.routes.get("/model_selector/models")
async def get_models_by_type(request):
    model_type = request.rel_url.query.get("type", "All")
    models = ModelNameSelector.get_models(model_type)
    return web.json_response(models)

NODE_CLASS_MAPPINGS = {"ModelNameSelector": ModelNameSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"ModelNameSelector": "Model Name Selector"}
WEB_DIRECTORY = "./js"