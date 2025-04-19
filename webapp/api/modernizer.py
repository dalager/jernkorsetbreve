import json
from ollama import Client


system_prompt = "Du hjælper med at korrekturlæse danske breve fra første verdenskrig. Du fokuserer på at rette gamle stavemåder til nutidsdansk men opdager også, hvis der er ord, der er sammensat forkert, eller noget, der kan være indtastningsfejl. Du returnerer kun den rettede tekst i plain text format, uden kommentarer eller andet."


def modernize(text: str) -> tuple:
    client = Client(
        host="http://localhost:11434/",
        # host="http://dmzdocker04.eksponent.local:11434/",
        headers={"x-some-header": "some-value"},
    )
    response = client.chat(
        model="llama3.1",
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": f"Ret denne tekst til nutidsdansk:\n---\n{text}",
            },
        ],
        stream=False,
    )

    eval_duration_ns = response.eval_duration
    eval_count = response.eval_count
    tps = eval_count / (eval_duration_ns / 1e9)
    print("--------------------")
    print(response.message.content)
    print(f"Eval_tps {tps}")
    print(f"Duration {response.eval_duration/1e9}")
    print("--------------------")

    return response.message.content, tps
