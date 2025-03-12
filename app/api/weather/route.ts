import { NextResponse } from 'next/server';
import { Tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { city } = body;

    if (!city) {
      return NextResponse.json(
        { error: 'City parameter is required' },
        { status: 400 }
      );
    }

    // Create the model and tools
    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
    });

    const tools = [new WeatherTool()];

    // Create the React agent with state modifier
    const agent = createReactAgent({
      llm: model,
      tools,
      stateModifier: new SystemMessage("You're a weather reporter. When you receive weather data, return it in this exact JSON format: {\"success\": true, \"data\": {\"temperature\": \"X°C\", \"description\": \"Y\", \"humidity\": \"Z%\", \"windSpeed\": \"W m/s\"}, \"message\": \"Current weather information retrieved successfully.\"}"),
    });

    // Execute the agent
    const result = await agent.invoke({
      messages: [new HumanMessage(`Get the current weather in ${city}.`)],
    });

    // Parse the final message to get our formatted response
    const finalMessage = result.messages[result.messages.length - 1];
    const response = JSON.parse(finalMessage.content as string);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in weather route:', error);
    return NextResponse.json(
      { error: 'Failed to process weather request' },
      { status: 500 }
    );
  }
} 