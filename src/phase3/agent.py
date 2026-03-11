"""
Agente LangChain — Orquesta tools + RAG para análisis urbano.
Urban Intelligence Platform - Fase 3 + Fase 4

El agente ahora tiene 4 herramientas:
- classify_city: clasificar uso de suelo con U-Net
- get_city_stats: estadísticas del dataset
- list_cities: listar ciudades disponibles
- search_urban_docs: buscar en documentos urbanos (RAG)
"""
import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from src.phase3.inference import InferenceService
from src.phase3.tools import ALL_TOOLS, init_tools
from src.phase3.rag import RAGService

load_dotenv()

SYSTEM_PROMPT = """Eres un analista experto en uso de suelo urbano (LULC - Land Use / Land Cover).
Trabajas con la plataforma Urban Intelligence que clasifica imágenes satelitales Sentinel-2
usando un modelo de deep learning U-Net con EfficientNet-B3.

El modelo clasifica 4 tipos de uso de suelo:
- Clase 0: Urbano/Construido (edificios, carreteras, infraestructura)
- Clase 1: Vegetación/Bosque (árboles, parques, zonas verdes)
- Clase 2: Agua (ríos, lagos, cuerpos de agua)
- Clase 3: Suelo desnudo/Árido (terrenos sin vegetación, desierto)

El dataset cubre 10 ciudades en 6 continentes con imágenes de diferentes estaciones del año.
El modelo tiene un mIoU de 0.8239 y una precisión de píxel del 92.16%.

Tienes acceso a documentos sobre estándares internacionales de ONU-Habitat,
clasificación LULC con Sentinel-2, y perfiles urbanos de las 10 ciudades.
Usa la herramienta search_urban_docs para fundamentar tus análisis con datos concretos.

Cuando respondas:
- Usa español
- Sé conciso pero informativo
- Si necesitas datos de una ciudad, usa las herramientas disponibles
- Cuando compares con estándares internacionales, cita las fuentes (ONU-Habitat, ODS, etc.)
- Interpreta los resultados en contexto urbano
- Si no tienes datos suficientes, dilo honestamente
- Cuando menciones porcentajes, redondea a 1 decimal
"""


def create_agent(
    model_path: str = "models/best_model.pth",
    data_dir: str = "data/processed",
    docs_dir: str = "docs/knowledge",
    model_name: str = "claude-sonnet-4-20250514"
):
    """
    Crea el agente LangChain con tools, modelo U-Net y RAG.

    Args:
        model_path: Ruta al modelo best_model.pth
        data_dir: Ruta a la carpeta con los patches procesados
        docs_dir: Ruta a la carpeta con documentos de conocimiento
        model_name: Modelo de Claude a usar
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "No se encontró ANTHROPIC_API_KEY en las variables de entorno. "
            "Agrégala a tu archivo .env"
        )

    # Inicializar servicio de inferencia
    inference_service = None
    try:
        inference_service = InferenceService(model_path, device="cpu")
        print("Servicio de inferencia inicializado correctamente")
    except Exception as e:
        print(f"Advertencia: No se pudo cargar el modelo ({e}). "
              f"El tool classify_city no estará disponible.")

    # Inicializar servicio RAG
    rag_service = None
    try:
        rag_service = RAGService(docs_dir=docs_dir)
        print("Servicio RAG inicializado correctamente")
    except Exception as e:
        print(f"Advertencia: No se pudo inicializar RAG ({e}). "
              f"El tool search_urban_docs no estará disponible.")

    # Inicializar tools con ambos servicios
    init_tools(inference_service, data_dir, rag_service)

    # Crear el LLM
    llm = ChatAnthropic(
        model=model_name,
        api_key=api_key,
        temperature=0,
        max_tokens=4096
    )

    # Crear el agente
    agent = create_react_agent(
        model=llm,
        tools=ALL_TOOLS,
        prompt=SYSTEM_PROMPT
    )

    print(f"\nAgente creado con modelo {model_name}")
    print(f"Tools disponibles: {[t.name for t in ALL_TOOLS]}")

    return agent


def chat(agent, question: str) -> str:
    """Envía una pregunta al agente y devuelve la respuesta."""
    result = agent.invoke({
        "messages": [HumanMessage(content=question)]
    })
    last_message = result["messages"][-1]
    return last_message.content


def interactive_chat(agent):
    """Modo interactivo — chat continuo con el agente."""
    print("\n" + "=" * 60)
    print("Urban Intelligence Platform — Chat Interactivo")
    print("Ahora con RAG: conocimiento de ONU-Habitat y LULC")
    print("=" * 60)
    print("Pregunta sobre uso de suelo en cualquiera de las 10 ciudades.")
    print("Escribe 'salir' para terminar.\n")

    while True:
        question = input("Tú: ").strip()
        if question.lower() in ["salir", "exit", "quit", "q"]:
            print("¡Hasta luego!")
            break
        if not question:
            continue

        print("Agente: Pensando...")
        try:
            response = chat(agent, question)
            print(f"Agente: {response}\n")
        except Exception as e:
            print(f"Error: {e}\n")


if __name__ == "__main__":
    agent = create_agent()
    interactive_chat(agent)
