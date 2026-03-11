"""
Agente LangChain — Orquesta los tools para responder preguntas sobre uso de suelo.
Urban Intelligence Platform - Fase 3

El agente recibe preguntas en lenguaje natural y decide qué herramientas usar:
- classify_city: para analizar el uso de suelo con el modelo U-Net
- get_city_stats: para consultar información del dataset
- list_cities: para ver qué ciudades están disponibles

Uso:
    from phase3.agent import create_agent, chat
    agent = create_agent()
    response = chat(agent, "¿Qué porcentaje de Monterrey es zona urbana?")
"""
import os
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from src.phase3.inference import InferenceService
from src.phase3.tools import ALL_TOOLS, init_tools

load_dotenv()

# Prompt del sistema para el agente
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

Cuando respondas:
- Usa español
- Sé conciso pero informativo
- Si necesitas datos de una ciudad, usa las herramientas disponibles
- Interpreta los resultados en contexto urbano (qué significa para la ciudad)
- Si no tienes datos suficientes, dilo honestamente
- Cuando menciones porcentajes, redondea a 1 decimal
"""


def create_agent(
    model_path: str = "models/best_model.pth",
    data_dir: str = "data/processed",
    model_name: str = "claude-sonnet-4-20250514"
):
    """
    Crea el agente LangChain con tools y el modelo U-Net.

    Args:
        model_path: Ruta al modelo best_model.pth
        data_dir: Ruta a la carpeta con los patches procesados
        model_name: Modelo de Claude a usar

    Returns:
        Agente listo para recibir preguntas
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "No se encontró ANTHROPIC_API_KEY en las variables de entorno. "
            "Agrégala a tu archivo .env"
        )

    # Inicializar el servicio de inferencia
    try:
        inference_service = InferenceService(model_path, device="cpu")
        init_tools(inference_service, data_dir)
        print("Servicio de inferencia inicializado correctamente")
    except Exception as e:
        print(f"Advertencia: No se pudo cargar el modelo ({e}). "
              f"El tool classify_city no estará disponible.")
        init_tools(None, data_dir)

    # Crear el LLM
    llm = ChatAnthropic(
        model=model_name,
        api_key=api_key,
        temperature=0,
        max_tokens=4096
    )

    # Crear el agente con tools
    agent = create_react_agent(
        model=llm,
        tools=ALL_TOOLS,
        prompt=SYSTEM_PROMPT
    )

    print(f"Agente creado con modelo {model_name}")
    print(f"Tools disponibles: {[t.name for t in ALL_TOOLS]}")

    return agent


def chat(agent, question: str) -> str:
    """
    Envía una pregunta al agente y devuelve la respuesta.

    Args:
        agent: Agente creado con create_agent()
        question: Pregunta en lenguaje natural

    Returns:
        Respuesta del agente como string
    """
    result = agent.invoke({
        "messages": [HumanMessage(content=question)]
    })

    # Extraer la última respuesta del agente
    last_message = result["messages"][-1]
    return last_message.content


def interactive_chat(agent):
    """Modo interactivo — chat continuo con el agente."""
    print("\n" + "=" * 60)
    print("Urban Intelligence Platform — Chat Interactivo")
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


# ── Ejecución directa para pruebas ──
if __name__ == "__main__":
    agent = create_agent()
    interactive_chat(agent)
