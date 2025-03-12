import { Tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { AgentState } from "../types";

// OpenWeather API configuration
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'http://api.openweathermap.org/data/2.5';

// Create a tool for fetching weather data
class WeatherTool extends Tool {
  name = "getCurrentWeather";
  description = "Get the current weather in a given city. Input should be a city name.";

  async _call(city: string) {
    try {
      const response = await fetch(
        `${OPENWEATHER_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`
      );
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return JSON.stringify({
        temperature: data.main.temp,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed
      });
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }
}

// Create the weather agent node
export const createWeatherAgentNode = (model: ChatOpenAI) => {
  const tools = [new WeatherTool()];

  const weatherAgent = createReactAgent({
    llm: model,
    tools,
    stateModifier: new SystemMessage("You're a weather reporter. When you receive weather data, return it in this exact JSON format: {\"success\": true, \"data\": {\"temperature\": \"X°C\", \"description\": \"Y\", \"humidity\": \"Z%\", \"windSpeed\": \"W m/s\"}, \"message\": \"Current weather information retrieved successfully.\"}"),
  });

  return async (
    state: AgentState,
    config?: RunnableConfig,
  ) => {
    const result = await weatherAgent.invoke(state, config);
    
    const lastMessage = result.messages[result.messages.length - 1];
    
    return {
      messages: [new AIMessage(lastMessage.content.toString())],
    };
  };
}; 