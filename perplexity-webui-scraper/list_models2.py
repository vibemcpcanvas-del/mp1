from perplexity_webui_scraper import MODELS
for model in MODELS.list_all():
    print(f"ID: {model.id}, Name: {model.name}, Status: {model.status}")
