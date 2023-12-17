import pandas as pd
from SPARQLWrapper import SPARQLWrapper, JSON


class WikiDataClient:
    def __init__(self):
        self.sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
        self.sparql.agent = "ww1 lettercollection 0.1 (christian@dalager.com)"

    def query(self, query):
        self.sparql.setQuery(query)
        self.sparql.setReturnFormat(JSON)
        try:
            results = self.sparql.query().convert()
            return results
        except Exception as e:
            print(f"An error occurred: {e}")

    def query_to_dataframe(self, query):
        results = self.query(query)
        return self.map_results_to_dataframe(results)

    def map_results_to_dataframe(self, results):
        data = []
        for result in results["results"]["bindings"]:
            dict = {}
            for key in result.keys():
                dict[key] = result[key]["value"]

            data.append(dict)
        return pd.DataFrame(data)
