def create_geopandas_from_csv():
    import pandas as pd
    import geopandas as gpd
    from shapely import wkt

    df = pd.read_csv("../data/letters.csv")
    df.dropna(subset=["location"], inplace=True)

    # parse into geopandas
    df["geometry"] = df["location"].str.split(",")

    df["geometry"] = df["geometry"].apply(lambda x: x[:-1])

    # convert geometry to wkt from [lat,lon] to POINT(lon lat)
    df["geometry"] = df["geometry"].apply(lambda x: "POINT (" + x[1] + " " + x[0] + ")")

    # geometry to geometry object
    df["geometry"] = df["geometry"].apply(wkt.loads)
    # delete location
    df.drop(["location"], axis=1, inplace=True)

    # convert to geopandas dataframe
    ldf = gpd.GeoDataFrame(df, geometry="geometry")
    # date a datetime object
    ldf["date"] = pd.to_datetime(ldf["date"])
    ldf.set_crs("EPSG:4326", allow_override=True, inplace=True)
    return ldf
