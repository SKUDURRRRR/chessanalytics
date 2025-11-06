# AI-Powered Comment Generation Setup Guide

This guide explains how to set up Claude 3.5 Sonnet (Anthropic) for generating human-like chess comments tailored for players rated 600-1800 ELO.

## Overview

The system now uses **Claude 3.5 Sonnet** (Anthropic) to generate natural, educational chess comments. The AI:
- Explains moves in simple, clear language
- Adjusts complexity based on player ELO
- Provides encouraging, educational feedback
- Falls back to template-based comments if AI is unavailable

## Why Claude 3.5 Sonnet?

**Claude 3.5 Sonnet** is recommended because:
- ✅ Excellent at explaining complex concepts simply
- ✅ Designed to be helpful and educational
- ✅ Good at adjusting tone/complexity for different skill levels
- ✅ Natural, conversational language
- ✅ **More cost-effective than GPT-4 Turbo**
- ✅ Reasonable pricing (~$3 per 1M input tokens, ~$15 per 1M output tokens)

## Cost Comparison

**Claude 3.5 Sonnet:**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens
- **Per comment:** ~$0.001-0.002 (less than a penny)
- **1000 comments:** ~$1-2
- **10,000 comments:** ~$10-20

**GPT-4 Turbo (for comparison):**
- Input: $10 per 1M tokens
- Output: $30 per 1M tokens
- **Per comment:** ~$0.006-0.009
- **1000 comments:** ~$6-9
- **10,000 comments:** ~$60-90

**Savings:** Claude is approximately **3-4x cheaper** than GPT-4 Turbo for this use case!

## Setup Steps

### 1. Get Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create Key"**
5. Copy the key (starts with `sk-ant-api03-...`)
6. **Important:** Save it immediately - you won't be able to see it again!

### 2. Add Environment Variable

Add the API key to your environment:

**For Local Development:**
```bash
# In your .env file (or .env.local)
ANTHROPIC_API_KEY=sk-ant-api03-your_actual_key_here
AI_ENABLED=true
AI_MODEL=claude-3-5-sonnet-20240620
```

**For Production (Railway):**
1. Go to Railway Dashboard → Your Service → Variables
2. Add:
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-your_actual_key_here`
   - `AI_ENABLED` = `true`
   - `AI_MODEL` = `claude-3-5-sonnet-20240620` (or `claude-3-5-sonnet` for latest)

### 3. Install Dependencies

```bash
cd python
pip install -r requirements.txt
```

This will install the `anthropic` package (version 0.18.0+).

### 4. Verify Setup

The system will automatically:
- ✅ Try to use AI if API key is configured
- ✅ Fall back to template-based comments if AI fails
- ✅ Log warnings if AI is not available (non-blocking)

## How It Works

### Automatic Integration

The AI comment generator is integrated into `ChessCoachingGenerator`:

1. **First Attempt:** Try AI generation with Claude 3.5 Sonnet
2. **Fallback:** If AI fails or is unavailable, use template-based comments
3. **No Breaking Changes:** Existing functionality continues to work

### Comment Generation Flow

```
Move Analysis
    ↓
Try AI Generation (if enabled)
    ↓
    ├─ Success → AI-generated comment
    └─ Failure → Template-based comment
```

### ELO-Based Complexity

The AI adjusts its explanations based on estimated player ELO:

- **600-900 ELO (Beginner):** Very simple language, analogies, minimal chess notation
- **900-1400 ELO (Intermediate):** Clear explanations, chess terms explained
- **1400-1800 ELO (Advanced Intermediate):** Detailed but accessible, can use terminology

## Cost Management

### Estimated Costs

**Claude 3.5 Sonnet Pricing:**
- **Input:** $3 per 1M tokens
- **Output:** $15 per 1M tokens

**Per Comment:**
- **Average comment:** ~200-300 tokens (input + output)
- **Cost per comment:** ~$0.001-0.002 (less than a penny)
- **1000 comments:** ~$1-2
- **10,000 comments:** ~$10-20

### Rate Limiting & Caching

Consider implementing:
- **Caching:** Cache comments for identical positions/moves
- **Rate Limiting:** Limit AI calls per user per day
- **Selective Usage:** Only use AI for important moves (blunders, brilliant moves)

Future improvements could add:
- Redis caching for common positions
- Rate limiting per user
- Feature flags to enable/disable AI per user tier

## Testing

To test the AI comment generation:

1. Make sure `ANTHROPIC_API_KEY` is set
2. Run a game analysis
3. Check logs for AI-generated comments
4. Compare with template-based comments

## Troubleshooting

### AI Not Generating Comments

**Check:**
1. API key is set correctly: `echo $ANTHROPIC_API_KEY`
2. API key is valid (not expired or revoked)
3. Internet connection (API calls require network)
4. Check logs for error messages
5. Verify your Anthropic account has credits/balance

### Fallback to Templates

If you see "AI comment generation failed, falling back to templates" in logs:
- This is normal behavior - the system gracefully falls back
- Check API key validity
- Check network connectivity
- Review error messages in logs
- Check Anthropic account status and credits

### Rate Limits

Anthropic has rate limits based on your plan:
- **Standard accounts:** Reasonable limits for most use cases
- If you hit limits, the system will fall back to templates

Check your limits at [Anthropic Console](https://console.anthropic.com/)

### Cost Concerns

To disable AI temporarily:
```bash
AI_ENABLED=false
```

The system will continue using template-based comments.

## Configuration Options

Available environment variables:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional
AI_ENABLED=true                    # Enable/disable AI (default: true)
AI_MODEL=claude-3-5-sonnet-20240620 # Model to use
AI_MAX_TOKENS=500                   # Max tokens per response
AI_TEMPERATURE=0.7                  # Creativity (0.0-1.0, default: 0.7)
```

### Available Models

You can use different Anthropic models by changing `AI_MODEL`:

- `claude-3-5-sonnet` - Recommended, latest version, best balance of quality and cost
- `claude-3-5-sonnet-20240620` - June 2024 version, best balance of quality and cost
- `claude-3-opus-20240229` - Highest quality (more expensive)
- `claude-3-haiku-20240307` - Fastest and cheapest (lower quality)

## Monitoring Usage

### Check API Usage

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Navigate to **Usage** or **Billing** section
3. View API usage and costs
4. Set up usage alerts if needed

### Set Usage Limits

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Navigate to **Settings** or **Billing**
3. Set spending limits to prevent unexpected charges
4. Configure alerts for high usage

## Future Enhancements

Potential improvements:
- [x] Support for Claude 3.5 Sonnet
- [ ] Caching layer for common positions
- [ ] Rate limiting per user
- [ ] Batch processing for multiple moves
- [ ] Custom prompts per user preference
- [ ] Multi-language support
- [ ] Support for Claude 3.7 (when available)

## Support

For issues or questions:
1. Check logs for error messages
2. Verify API key is valid
3. Test with a simple move analysis
4. Check Anthropic API status: https://status.anthropic.com/
5. Review Anthropic API documentation: https://docs.anthropic.com/

## Cost Optimization Tips

To minimize API costs:
- **Monitor usage:** Track API calls and costs regularly
- **Optimize prompts:** Shorter prompts = fewer tokens = lower costs
- **Caching:** Cache identical positions to reduce API calls
- **Selective use:** Consider using AI only for important moves (brilliant moves, blunders)
- **Batch processing:** Process multiple moves together when possible

## Why We Chose Claude Over GPT-4

**Cost Savings:**
- Claude 3.5 Sonnet is **3-4x cheaper** than GPT-4 Turbo
- For high-volume usage, this adds up significantly
- Better value for educational chess comments

**Quality:**
- Claude excels at educational, helpful explanations
- Natural, conversational tone
- Great at adjusting complexity for different skill levels

**Reliability:**
- Stable API with good uptime
- Predictable pricing
- Good documentation and support
