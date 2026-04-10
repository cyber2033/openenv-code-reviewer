# Hugging Face Space Deployment Guide 🚀

Follow these steps to deploy your **OpenEnv AI Code Reviewer** to Hugging Face Spaces.

## STEP 1 - Create Hugging Face Space
1.  Navigate to [huggingface.co/new-space](https://huggingface.co/new-space).
2.  **Space Name:** `openenv-code-reviewer`
3.  **SDK:** Select **Docker** (Blank template).
4.  **Visibility:** Set to **Public**.
5.  Click **Create Space**.

## STEP 2 - Set Space Secrets
Go to your Space's **Settings** tab → **Variables and secrets**. Add the following secret/variable:

| Key | Value |
| :--- | :--- |
| `HF_TOKEN` | *Your Hugging Face Write Token* |
| `API_BASE_URL` | `https://router.huggingface.co/v1` |
| `MODEL_NAME` | `Qwen/Qwen2.5-72B-Instruct` |
| `SERVER_URL` | `http://localhost:7860` |
| `BENCHMARK` | `code-review` |

## STEP 3 - Push Code to Space
Open your terminal in the root directory and run:

```bash
git init
git add .
git commit -m "initial submission"
git remote add space https://huggingface.co/spaces/YOUR_USERNAME/openenv-code-reviewer
git push space main
```
*(Replace `YOUR_USERNAME` with your actual Hugging Face username)*

## STEP 4 - Verify Deployment
Wait 2-3 minutes for the build to finish. Then, test the deployment using `curl`:

```bash
curl -X POST https://YOUR_USERNAME-openenv-code-reviewer.hf.space/reset \
     -H "Content-Type: application/json" \
     -d '{"task": "easy"}'
```

### Expected Response:
```json
{
  "observation": {...},
  "info": {
    "episode_id": "...",
    "task": "easy"
  }
}
```

---

## Troubleshooting

### Deployment Fails (Build Error)
- Check the **Logs** tab in your Space.
- Ensure the `Dockerfile` is in the root directory.
- Check that `requirements.txt` contains all necessary dependencies.

### Reset Returns 404 or 500
- Ensure the `server/main.py` is correctly exposed on port `7860`.
- Verify that `task_name` matches "easy", "medium", or "hard".

### Inference Script Returns Score 0.0
- Check if `MODEL_NAME` and `HF_TOKEN` are correctly set in the secrets.
- Check the logs in `inference.py` for "Parse error" or "LLM call error".
