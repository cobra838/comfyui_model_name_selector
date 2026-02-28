import folder_paths
import random
import server
from aiohttp import web
import json
import os

class FavoritesManager:
    """Manages favorite models storage."""

    FAVORITES_FILE = os.path.join(
        folder_paths.get_user_directory(),
        "model_selector",
        "favorites.json"
    )

    @classmethod
    def load_favorites(cls):
        """Load favorites from file."""
        os.makedirs(os.path.dirname(cls.FAVORITES_FILE), exist_ok=True)
        if not os.path.exists(cls.FAVORITES_FILE):
            return []

        try:
            with open(cls.FAVORITES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []

    @classmethod
    def save_favorites(cls, favorites):
        """Save favorites to file."""
        with open(cls.FAVORITES_FILE, 'w', encoding='utf-8') as f:
            json.dump(favorites, f, indent=2, ensure_ascii=False)

    @classmethod
    def add_favorite(cls, model):
        """Add model to favorites."""
        favorites = cls.load_favorites()
        if model not in favorites:
            favorites.append(model)
            cls.save_favorites(favorites)
        return favorites

    @classmethod
    def remove_favorite(cls, model):
        """Remove model from favorites."""
        favorites = cls.load_favorites()
        if model in favorites:
            favorites.remove(model)
            cls.save_favorites(favorites)
        return favorites

    @classmethod
    def is_favorite(cls, model):
        """Check if model is in favorites."""
        return model in cls.load_favorites()


class ModelNameSelector:

    # Global state to track last used model per node
    _last_models = {}

    @classmethod
    def INPUT_TYPES(s):
        all_folders = s.get_folders("All")
        all_models = s.get_models("All", "All", "All")
        models_with_markers = ["(Start)"] + all_models + ["(End)"]

        return {
            "required": {
                "model_type": (["All", "Checkpoints", "Diffusion Models", "GGUF", "Favorites"],),
                "folder": (all_folders,),
                "subfolder": (["All"],),
                "model_name": (models_with_markers,),
                "after_generate": (["fixed", "increment", "decrement", "randomize"],),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID"
            }
        }

    @classmethod
    def get_folders(s, model_type):
        if model_type == "Favorites":
            models = FavoritesManager.load_favorites()
        else:
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

        return sorted(folders, key=lambda x: (x != "All", x == "(Root)", x))

    @classmethod
    def get_subfolders(s, model_type, folder):
        if folder == "All":
            return ["All"]

        if model_type == "Favorites":
            models = FavoritesManager.load_favorites()
        else:
            models = []
            if model_type in ["All", "Checkpoints"]:
                models += folder_paths.get_filename_list("checkpoints")
            if model_type in ["All", "Diffusion Models"]:
                models += folder_paths.get_filename_list("diffusion_models")
            if model_type in ["All", "GGUF"]:
                models += folder_paths.get_filename_list("unet_gguf")

        if folder == "(Root)":
            return ["All"]

        subfolders = set(["All"])
        for model in models:
            if model.startswith(folder + '\\') or model.startswith(folder + '/'):
                parts = model.replace(folder + '\\', '').replace(folder + '/', '').split('\\' if '\\' in model else '/')
                if len(parts) > 1:
                    subfolders.add(parts[0])

        return sorted(subfolders, key=lambda x: (x != "All", x.lower()))

    @classmethod
    def get_models(s, model_type, folder, subfolder):
        if model_type == "Favorites":
            models = FavoritesManager.load_favorites()
        else:
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

        if subfolder != "All" and folder != "All" and folder != "(Root)":
            if models:
                sep = '\\' if '\\' in models[0] else '/'
            else:
                sep = '\\'
            prefix = folder + sep + subfolder + sep
            models = [m for m in models if m.startswith(prefix)]

        return sorted(models) if models else ["No models found"]

    RETURN_TYPES = ("*",)
    RETURN_NAMES = ("model_name",)
    FUNCTION = "get_name"
    CATEGORY = "loaders"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(s, model_type, folder, subfolder, model_name, after_generate):
        models = s.get_models(model_type, folder, subfolder)
        return hash(tuple(models))

    def get_name(self, model_type, folder, subfolder, model_name, after_generate, unique_id=None):
        models = self.get_models(model_type, folder, subfolder)

        if models == ["No models found"]:
            return {"ui": {"model_name": [model_name]}, "result": (model_name,)}

        # Handle start/end markers
        if model_name == "(Start)":
            selected = models[0]
            if unique_id:
                self._last_models[unique_id] = selected
            return {"ui": {"model_name": [selected]}, "result": (selected,)}
        elif model_name == "(End)":
            selected = models[-1]
            if unique_id:
                self._last_models[unique_id] = selected
            return {"ui": {"model_name": [selected]}, "result": (selected,)}

        # Check if we have a last used model for this node
        # if unique_id and unique_id in self._last_models:
            # last_model = self._last_models[unique_id]
            # if last_model in models:
                # model_name = last_model

        if model_name not in models:
            model_name = models[0]

        selected = model_name

        if after_generate != "fixed":
            idx = models.index(model_name)

            if after_generate == "increment":
                if idx < len(models) - 1:
                    selected = models[idx + 1]
                else:
                    # selected = models[0]  # Loop back to start
                    raise ValueError(f"Reached end of model list (last model: {model_name})")
            elif after_generate == "decrement":
                if idx > 0:
                    selected = models[idx - 1]
                else:
                    # selected = models[-1]  # Loop to end
                    raise ValueError(f"Reached start of model list (first model: {model_name})")
            elif after_generate == "randomize":
                if len(models) > 1:
                    other_models = [m for m in models if m != model_name]
                    selected = random.choice(other_models)
                else:
                    selected = models[0]

        # Store the selected model for next execution
        if unique_id:
            self._last_models[unique_id] = selected

        return {"ui": {"model_name": [selected]}, "result": (selected,)}

@server.PromptServer.instance.routes.get("/model_selector/folders")
async def get_folders_by_type(request):
    model_type = request.rel_url.query.get("type", "All")
    return web.json_response(ModelNameSelector.get_folders(model_type))

@server.PromptServer.instance.routes.get("/model_selector/subfolders")
async def get_subfolders_by_folder(request):
    model_type = request.rel_url.query.get("type", "All")
    folder = request.rel_url.query.get("folder", "All")
    return web.json_response(ModelNameSelector.get_subfolders(model_type, folder))

@server.PromptServer.instance.routes.get("/model_selector/models")
async def get_models_by_type(request):
    model_type = request.rel_url.query.get("type", "All")
    folder = request.rel_url.query.get("folder", "All")
    subfolder = request.rel_url.query.get("subfolder", "All")
    return web.json_response(ModelNameSelector.get_models(model_type, folder, subfolder))

@server.PromptServer.instance.routes.get("/model_selector/favorites")
async def get_favorites_endpoint(request):
    favorites = FavoritesManager.load_favorites()
    return web.json_response(favorites)

@server.PromptServer.instance.routes.post("/model_selector/favorites/add")
async def add_favorite_endpoint(request):
    data = await request.json()
    model = data.get("model")
    if model:
        favorites = FavoritesManager.add_favorite(model)
        return web.json_response({"success": True, "favorites": favorites})
    return web.json_response({"success": False}, status=400)

@server.PromptServer.instance.routes.post("/model_selector/favorites/remove")
async def remove_favorite_endpoint(request):
    data = await request.json()
    model = data.get("model")
    if model:
        favorites = FavoritesManager.remove_favorite(model)
        return web.json_response({"success": True, "favorites": favorites})
    return web.json_response({"success": False}, status=400)

@server.PromptServer.instance.routes.get("/model_selector/favorites/check")
async def check_favorite_endpoint(request):
    model = request.rel_url.query.get("model", "")
    is_fav = FavoritesManager.is_favorite(model)
    return web.json_response({"is_favorite": is_fav})

NODE_CLASS_MAPPINGS = {"ModelNameSelector": ModelNameSelector}
NODE_DISPLAY_NAME_MAPPINGS = {"ModelNameSelector": "Model Name Selector"}
WEB_DIRECTORY = "./js"