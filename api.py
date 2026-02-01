"""API endpoints for model selector frontend."""

import server
from aiohttp import web

from .model_manager import ModelManager
from .favorites_manager import FavoritesManager


@server.PromptServer.instance.routes.get("/model_selector/folders")
async def get_folders_endpoint(request):
    """Get list of folders filtered by model type."""
    model_type = request.rel_url.query.get("type", "All")
    folders = ModelManager.get_folders(model_type)
    return web.json_response(folders)


@server.PromptServer.instance.routes.get("/model_selector/subfolders")
async def get_subfolders_endpoint(request):
    """Get list of subfolders for a specific folder."""
    model_type = request.rel_url.query.get("type", "All")
    folder = request.rel_url.query.get("folder", "All")
    subfolders = ModelManager.get_subfolders(model_type, folder)
    return web.json_response(subfolders)


@server.PromptServer.instance.routes.get("/model_selector/models")
async def get_models_endpoint(request):
    """Get list of models filtered by type, folder, and subfolder."""
    model_type = request.rel_url.query.get("type", "All")
    folder = request.rel_url.query.get("folder", "All")
    subfolder = request.rel_url.query.get("subfolder", "All")
    models = ModelManager.get_models(model_type, folder, subfolder)
    return web.json_response(models)


@server.PromptServer.instance.routes.get("/model_selector/favorites")
async def get_favorites_endpoint(request):
    """Get list of favorite models."""
    favorites = FavoritesManager.load_favorites()
    return web.json_response(favorites)


@server.PromptServer.instance.routes.post("/model_selector/favorites/add")
async def add_favorite_endpoint(request):
    """Add model to favorites."""
    data = await request.json()
    model = data.get("model")
    if model:
        favorites = FavoritesManager.add_favorite(model)
        return web.json_response({"success": True, "favorites": favorites})
    return web.json_response({"success": False}, status=400)


@server.PromptServer.instance.routes.post("/model_selector/favorites/remove")
async def remove_favorite_endpoint(request):
    """Remove model from favorites."""
    data = await request.json()
    model = data.get("model")
    if model:
        favorites = FavoritesManager.remove_favorite(model)
        return web.json_response({"success": True, "favorites": favorites})
    return web.json_response({"success": False}, status=400)


@server.PromptServer.instance.routes.get("/model_selector/favorites/check")
async def check_favorite_endpoint(request):
    """Check if model is in favorites."""
    model = request.rel_url.query.get("model", "")
    is_fav = FavoritesManager.is_favorite(model)
    return web.json_response({"is_favorite": is_fav})