import pandas as pd
from shapely import wkt
import geopandas as gpd


class WikidataBattleMapper:
    def __init__(self):
        pass

    def map_battles(self, df):
        # Parse WKT for each row in 'location'
        if "location" in df.columns:
            df["geometry"] = df["location"].apply(
                lambda x: wkt.loads(x) if pd.notnull(x) else None
            )
            df.drop(columns=["location"], inplace=True)

        # Convert dates
        if "startTime" in df.columns:
            df["start_time"] = pd.to_datetime(df["startTime"], errors="coerce")
        if "endTime" in df.columns:
            df["end_time"] = pd.to_datetime(df["endTime"], errors="coerce")
        if "pointInTime" in df.columns:
            df["date"] = pd.to_datetime(df["pointInTime"], errors="coerce")
        df.drop(
            columns=["startTime", "endTime", "pointInTime"],
            inplace=True,
            errors="ignore",
        )

        # Rename 'battleLabel' to 'name'
        if "battleLabel" in df.columns:
            df.rename(columns={"battleLabel": "name"}, inplace=True)

        # Convert DataFrame to GeoDataFrame
        gdf = gpd.GeoDataFrame(df, geometry="geometry")
        gdf.crs = "epsg:4326"

        return gdf
