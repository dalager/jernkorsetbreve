import pandas as pd
from shapely import wkt
from shapely.geometry import Point
import geopandas as gpd


def create_geopandas_from_battle_csv():
    bdf = gpd.read_file("../historical_data/Battles_WW1.csv")
    bdf["geometry"] = bdf["Coordinates"].apply(
        lambda coord: Point(float(coord.split(",")[1]), float(coord.split(",")[0]))
    )

    # convert Date column to datetime
    bdf["Date"] = pd.to_datetime(bdf["Date"])
    bdf["EndDate"] = pd.to_datetime(bdf["EndDate"])
    # Sort the DataFrame by the date column
    bdf = bdf.sort_values("Date")
    bdf = bdf.reset_index(drop=True)
    # add battle_id
    bdf["battle_id"] = bdf.index + 1
    # move battle_id to first column
    cols = bdf.columns.tolist()
    cols = cols[-1:] + cols[:-1]
    bdf = bdf[cols]
    # lowercase column names
    bdf.columns = bdf.columns.str.lower()
    bdf.set_crs("EPSG:4326", allow_override=True, inplace=True)
    return bdf
