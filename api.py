"""API endpoints for model selector frontend."""

import server
from aiohttp import web

from .model_manager import ModelManager


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
