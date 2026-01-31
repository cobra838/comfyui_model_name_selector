import folder_paths
import random
import server
from aiohttp import web

class ModelNameSelector:
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model_type": (["All", "Checkpoints", "Diffusion Models", "GGUF"],),
                "folder": (s.get_folders("All"),),
                "model_name": (s.get_models("All", "All"),),
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
            }
        }
    
    @classmethod
    def get_folders(s, model_type):
        models = []
        if model_type in ["All", "Checkpoints"]:
            models += folder_paths.get_filename_list("checkpoints")
        if model_type in ["All", "Diffusion Models"]:
            models += folder_paths.get_filename_list("diffusion_models")
        if model_type in ["All", "GGUF"]:
            models += folder_paths.get_filename_list("unet_gguf")
        
        folders = set(["All"])
        for model in models:
            if '\\' in model or '/' in model:
                folder = model.split('\\')[0] if '\\' in model else model.split('/')[0]
                folders.add(folder)
            else:
                folders.add("(Root)")
        
        return sorted(folders, key=lambda x: (x == "All", x == "(Root)", x))
    
    @classmethod
    def get_models(s, model_type, folder):
        models = []
        if model_type in ["All", "Checkpoints"]:
            models += folder_paths.get_filename_list("checkpoints")
        if model_type in ["All", "Diffusion Models"]:
            models += folder_paths.get_filename_list("diffusion_models")
        if model_type in ["All", "GGUF"]:
            models += folder_paths.get_filename_list("unet_gguf")
        
        if folder != "All":
            if folder == "(Root)":
                models = [m for m in models if '\\' not in m and '/' not in m]
            else:
                models = [m for m in models if m.startswith(folder + '\\') or m.startswith(folder + '/')]
        
        return sorted(models) if models else ["No models found"]
    
    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("model_name",)
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True
    
    def get_name(self, model_type, folder, model_name, control_after_generate):
        models = self.get_models(model_type, folder)
        
        if models == ["No models found"]:
            return {"ui": {"model_name": [model_name]}, "result": (model_name,)}
        
        if model_name not in models:
            model_name = models[0]
        
        selected = model_name
        
        if control_after_generate != "fixed":
            idx = models.index(model_name)
            
            if control_after_generate == "increment":
                if idx < len(models) - 1:
                    selected = models[idx + 1]
                else:
                    raise ValueError(f"Reached end of model list (last model: {model_name})")
            elif control_after_generate == "decrement":
                if idx > 0:
                    selected = models[idx - 1]
                else:
                    raise ValueError(f"Reached start of model list (first model: {model_name})")
            elif control_after_generate == "randomize":
                if len(models) > 1:
                    other_models = [m for m in models if m != model_name]
                    selected = random.choice(other_models)
                else:
                    selected = models[0]
        
        return {"ui": {"model_name": [selected]}, "result": (selected,)}

@server.PromptServer.instance.routes.get("/model_selector/folders")
async def get_folders_by_type(request):
    model_type = request.rel_url.query.get("type", "All")
    return web.json_response(ModelNameSelector.get_folders(model_type))

@server.PromptServer.instance.routes.get("/model_selector/models")
async def get_models_by_type(request):
    model_type = request.rel_url.query.get("type", "All")
    folder = request.rel_url.query.get("folder", "All")
    return web.json_response(ModelNameSelector.get_models(model_type, folder))

NODE_CLASS_MAPPINGS = {"ModelNameSelector": ModelNameSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"ModelNameSelector": "Model Name Selector"}
WEB_DIRECTORY = "./js"