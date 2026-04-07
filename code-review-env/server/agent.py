import json
import os
import threading
import time
from typing import Any, Optional

import httpx
from openai import OpenAI
import google.generativeai as genai
from dotenv import load_dotenv

# Load surroundings
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SERVER_URL = os.getenv("SERVER_URL", f"http://127.0.0.1:{os.getenv('BACKEND_PORT', '7860')}")

SYSTEM_PROMPT = (
    "You are an expert code reviewer. Read the code diff carefully.\n"
    "Think step by step about what bugs exist (security, logic, performance).\n"
    "Then output ONLY one raw JSON object with these exact fields:\n"
    "{\n"
    "  \"line\": int, \n"
    "  \"severity\": \"critical\"|\"high\"|\"medium\"|\"low\", \n"
    "  \"category\": \"security\"|\"logic\"|\"null_check\"|\"type_error\"|\"performance\"|\"style\", \n"
    "  \"message\": \"str\", \n"
    "  \"fix\": \"str\", \n"
    "  \"done\": bool\n"
    "}\n"
    "Set done: true ONLY when you have found all bugs and want to finish the review.\n"
    "No markdown, no explanation, just raw JSON."
)

class CodeReviewAgent:
    def __init__(self, model_name: Optional[str] = None):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        
        # Determine which provider to use based on model_name or available keys
        self.provider = "openai"
        self.model_name = model_name or "gpt-4o-mini"
        
        # Override to Gemini if model suggests it or if OpenAI key is missing
        is_gemini_model = self.model_name and "gemini" in self.model_name.lower()
        
        if (self.gemini_key and is_gemini_model) or (self.gemini_key and (not self.openai_key or "your_" in self.openai_key)):
            self.provider = "gemini"
            self.model_name = model_name or "gemini-1.5-flash"
            genai.configure(api_key=self.gemini_key)
            self.gemini_model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=SYSTEM_PROMPT
            )
        else:
            self.provider = "openai"
            self.client = OpenAI(api_key=self.openai_key if self.openai_key and "your_" not in self.openai_key else "")

    def get_completion(self, diff_text: str) -> str:
        if self.provider == "gemini":
            response = self.gemini_model.generate_content(f"Diff:\n{diff_text}")
            return response.text
        else:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Diff:\n{diff_text}"},
                ],
                temperature=0.1,
                max_tokens=500,
            )
            return response.choices[0].message.content or ""

    def run_review(self, task_name: str):
        print(f"[AGENT] Starting review for {task_name} using {self.provider}:{self.model_name}")
        
        try:
            # Reset the environment
            resp = httpx.post(f"{SERVER_URL}/reset", json={"task_name": task_name}, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            obs = data["observation"]
        except Exception as e:
            print(f"[AGENT] Failed to reset: {e}")
            return

        done = False
        step = 0
        max_steps = obs.get("max_steps", 10)

        while not done and step < max_steps:
            step += 1
            diff_text = obs.get("diff", "")
            
            try:
                raw_response = self.get_completion(diff_text)
                # Cleanup potential markdown or fluff
                cleaned = raw_response.strip()
                if "```json" in cleaned:
                    cleaned = cleaned.split("```json")[1].split("```")[0].strip()
                elif "```" in cleaned:
                    cleaned = cleaned.split("```")[1].split("```")[0].strip()
                
                action = json.loads(cleaned)
                
                # Submit action
                step_resp = httpx.post(f"{SERVER_URL}/step", json=action, timeout=30.0)
                step_resp.raise_for_status()
                step_data = step_resp.json()
                
                obs = step_data["observation"]
                done = step_data["done"]
                reward = step_data["reward"]
                
                print(f"[AGENT] Step {step}: reward={reward:.2f} done={done}")
                
            except Exception as e:
                print(f"[AGENT] Error in step {step}: {e}")
                time.sleep(1) # Backoff
                continue

        print(f"[AGENT] Review finished for {task_name}")

def start_agent_thread(task_name: str, model_name: Optional[str] = None):
    agent = CodeReviewAgent(model_name)
    thread = threading.Thread(target=agent.run_review, args=(task_name,))
    thread.daemon = True
    thread.start()
    return thread

if __name__ == "__main__":
    # Test run
    agent = CodeReviewAgent()
    agent.run_review("easy_001")
