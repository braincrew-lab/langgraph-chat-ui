"""Chatbot graph for authenticated mode.

This graph is the same as standalone - authentication is handled
separately by the auth.py module.

Reference: https://langchain-ai.github.io/langgraph/
"""

from typing import Annotated

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class State(TypedDict):
    """The state of the chatbot."""

    messages: Annotated[list[BaseMessage], add_messages]


# Initialize the LLM
llm = ChatAnthropic(model="claude-sonnet-4-20250514")


def chatbot(state: State) -> dict:
    """Process messages and generate a response."""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


# Build the graph
builder = StateGraph(State)
builder.add_node("chatbot", chatbot)
builder.add_edge("__start__", "chatbot")

# Compile the graph
graph = builder.compile()
graph.name = "Authenticated Chatbot"
