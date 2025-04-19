import os
from modernizer import modernize


# Sample text from a WWI letter in Danish with old spelling
sample_text = """
Kære Moder!
Jeg haaber, at I alle har det godt. Jeg har det godt, men savner Eder meget. Vi har havt nogle haarde Dage, men nu er det bedre. Jeg har faaet Eders Pakke med Strømper og Chokolade, hvilket jeg takker mange Gange for. Det er en stor Glæde at modtage noget hjemmefra.
Veiret er blevet bedre, og vi har nu Solskin. Jeg haaber snart at kunne komme hjem paa Orlov.
Hils alle derhjemme fra mig.
Din hengivne Søn
"""

# Call the modernize function
print("Calling modernize function...")
modernized_text, tps = modernize(sample_text)

print("\nOriginal text:")
print(sample_text)

print("\nModernized text:")
print(modernized_text)

print(f"\nTokens per second: {tps:.2f}")
