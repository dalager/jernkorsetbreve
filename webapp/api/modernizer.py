import os
import time
from anthropic import Anthropic


system_prompt = "Du hjælper med at korrekturlæse danske breve fra første verdenskrig. Du fokuserer på at rette gamle stavemåder til nutidsdansk men opdager også, hvis der er ord, der er sammensat forkert, eller noget, der kan være indtastningsfejl. Du returnerer kun den rettede tekst i plain text format, uden kommentarer eller andet."


def modernize(text: str) -> tuple:
    # Get API key from environment variable
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    # Initialize Anthropic client
    client = Anthropic(api_key=api_key)

    # Start timing for performance metrics
    start_time = time.time()

    # Call Anthropic API
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Ret denne tekst til nutidsdansk:\n---\n{text}",
            }
        ],
        max_tokens=4000,
    )

    # Calculate performance metrics
    end_time = time.time()
    duration = end_time - start_time

    # Extract content - in newer versions, content is a list of blocks
    modernized_text = response.content[0].text

    # Calculate tokens per second (approximate)
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens
    total_tokens = input_tokens + output_tokens
    tps = total_tokens / duration if duration > 0 else 0

    print("--------------------")
    print(modernized_text)
    print(f"Tokens: {total_tokens}")
    print(f"Duration: {duration:.2f} seconds")
    print(f"TPS: {tps:.2f}")
    print("--------------------")

    return modernized_text, tps
