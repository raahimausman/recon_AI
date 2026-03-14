from pathlib import Path
from dotenv import load_dotenv
import os
from langchain_openai import AzureChatOpenAI

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")
api_key        = os.getenv("OPENAI_API_KEY")
azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment     = os.getenv("AZURE_OPENAI_DEPLOYMENT")

# LLM configuration
llm = AzureChatOpenAI(
    azure_endpoint=azure_endpoint,
    azure_deployment=deployment,
    openai_api_version="2023-06-01-preview",
    api_key=api_key
)