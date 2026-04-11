import asyncio
import json
import httpx
from openai import OpenAI

SYSTEM_PROMPT = (
    "You are an expert code reviewer. Read the code diff carefully.\n"
    "Identify bugs and output ONLY one raw JSON object with these fields:\n"
    '{"line": int, "severity": "high"|"medium"|"low", "message": "str", "done": bool}'
)

async def run_single_model(
    model_name: str,
    battle_id: str,
    diff: str,
    api_key: str,
    api_base_url: str,
    server_url: str
):
    """Run a single model iteratively against the battle endpoint."""
    client = OpenAI(api_key=api_key or "no-key", base_url=api_base_url)
    done = False
    step_count = 0
    max_steps = 6

    # Start the loop
    while not done and step_count < max_steps:
        step_count += 1

        try:
            # Simulate latency or processing by calling LLM
            # Since this function is async, we'll run the synchronous OpenAI call in a thread
            # or just call it directly if it's very fast. Better to use run_in_executor
            loop = asyncio.get_event_loop()
            
            def llm_call():
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Diff:\n{diff}"},
                    ],
                    temperature=0.1,
                )
                return completion.choices[0].message.content or ""
                
            raw_response = await loop.run_in_executor(None, llm_call)
            
            # Clean and Parse
            cleaned = raw_response.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0].strip()
            
            try:
                action_data = json.loads(cleaned)
            except json.JSONDecodeError:
                # Fallback to a default action if parsing fails
                action_data = {
                    "line": 1,
                    "severity": "medium",
                    "category": "logic",
                    "message": f"Couldn't parse response.",
                    "fix": "N/A",
                    "done": True
                }

            # Map the response to the Action model format expected by backend
            action_payload = {
                "line": action_data.get("line", 1),
                "severity": action_data.get("severity", "medium"),
                "category": action_data.get("category", "logic"),
                "message": action_data.get("message", "Review completed."),
                "fix": action_data.get("fix", "Review completed."),
                "done": action_data.get("done", False)
            }

            async with httpx.AsyncClient() as http_client:
                resp = await http_client.post(
                    f"{server_url}/battle/{battle_id}/step/{model_name}",
                    json=action_payload,
                    timeout=30.0
                )
                resp.raise_for_status()
                done = action_payload["done"]

        except Exception as e:
            print(f"Error in {model_name} step {step_count}: {e}")
            break

async def run_battle(
    battle_id: str,
    task: str,
    models: list[str],
    api_keys: dict[str, str],
    server_url: str
):
    """Run all models simultaneously."""
    # Obtain the diff for the task. In a real integration, we fetch the diff from the environment.
    # We will simulate looking up the diff (the models just need some text here to review).
    try:
        async with httpx.AsyncClient() as http_client:
            # We can use the reset endpoint to get the task diff
            # Using a simplified approach here by requesting a reset specifically but discarding the state.
            resp = await http_client.post(
                f"{server_url}/reset",
                json={"task_name": task},
                timeout=30.0
            )
            resp.raise_for_status()
            diff = resp.json()["observation"]["diff"]
    except Exception as e:
        diff = "def example():\n    pass # Provide a real diff here."
        print(f"Failed to fetch diff: {e}")

    # Launch all models in parallel
    tasks = []
    for model in models:
        key = api_keys.get(model, "")
        base_url = "https://api.openai.com/v1" # Customize based on model if needed
        tasks.append(
            run_single_model(
                model_name=model,
                battle_id=battle_id,
                diff=diff,
                api_key=key,
                api_base_url=base_url,
                server_url=server_url
            )
        )
    
    await asyncio.gather(*tasks)
