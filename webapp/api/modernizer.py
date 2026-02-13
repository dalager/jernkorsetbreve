import logging
import os
import time
from typing import Tuple

from anthropic import Anthropic, APIError, AuthenticationError, RateLimitError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Du hjælper med at korrekturlæse danske breve fra første verdenskrig. "
    "Du fokuserer på at rette gamle stavemåder til nutidsdansk men opdager også, "
    "hvis der er ord, der er sammensat forkert, eller noget, der kan være indtastningsfejl. "
    "Du returnerer kun den rettede tekst i plain text format, uden kommentarer eller andet."
)


def modernize(text: str) -> Tuple[str, float]:
    """
    Modernize old Danish text using Claude AI.

    Args:
        text: The historical Danish text to modernize

    Returns:
        Tuple of (modernized_text, tokens_per_second)

    Raises:
        ValueError: If ANTHROPIC_API_KEY is not set
        RuntimeError: If API call fails
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY environment variable is not set")
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    client = Anthropic(api_key=api_key)

    logger.debug(f"Sending modernization request ({len(text)} chars)")
    start_time = time.time()

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Ret denne tekst til nutidsdansk:\n---\n{text}",
                }
            ],
            max_tokens=4000,
        )
    except AuthenticationError as e:
        logger.error(f"Authentication failed: {e}")
        raise ValueError("Invalid ANTHROPIC_API_KEY") from e
    except RateLimitError as e:
        logger.warning(f"Rate limit exceeded: {e}")
        raise RuntimeError("API rate limit exceeded. Please try again later.") from e
    except APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise RuntimeError(f"API error: {e}") from e

    end_time = time.time()
    duration = end_time - start_time

    modernized_text = response.content[0].text

    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    total_tokens = input_tokens + output_tokens
    tps = total_tokens / duration if duration > 0 else 0

    logger.info(
        f"Modernization complete: {total_tokens} tokens in {duration:.2f}s ({tps:.2f} TPS)"
    )

    return modernized_text, tps
