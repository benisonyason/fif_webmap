import React, { useState, useEffect, useRef } from "react";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat } from "ol/proj";
import { Fill, Stroke, Style, Text } from "ol/style";
import Overlay from "ol/Overlay";
import Select from "ol/interaction/Select";
import { click } from "ol/events/condition";
import "ol/ol.css";
import { getArea } from "ol/sphere";
import { boundingExtent } from "ol/extent";
import Feature from "ol/Feature";
import Geometry from "ol/geom/Geometry";
import {
  FullScreen,
  defaults as defaultControls,
  ZoomToExtent,
} from "ol/control.js";
import { FeatureLike } from "ol/Feature";

const MapComponent: React.FC = () => {
  const [map, setMap] = useState<Map | null>(null);
  const popupContainer = useRef<HTMLDivElement | null>(null);

  const highlightStyle = new Style({
    stroke: new Stroke({
      color: "#00f",
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(0, 0, 255, 0.1)",
    }),
  });

  const defaultStyle = (feature: Feature<Geometry>) =>
    new Style({
      fill: new Fill({
        color: "rgba(173, 216, 230, 0.5)", // Light blue fill color with opacity
      }),
      stroke: new Stroke({
        color: "#008000", // Green stroke color
        width: 3, // Stroke width
      }),
      text: new Text({
        text: feature.getProperties().uniq_id, // Label text based on uniq_id property
        font: "12px Calibri,sans-serif",
        fill: new Fill({
          color: "#000",
        }),
        stroke: new Stroke({
          color: "#fff",
          width: 2,
        }),
        offsetY: -10,
        textAlign: "center",
      }),
    });

  useEffect(() => {
    const boundaryVectorSource = new VectorSource();

  const styleFunction = (feature: FeatureLike) => { // Explicitly specify the type
    const geometry = (feature as Feature<Geometry>).getGeometry();
    if (!geometry) return [];

    return [
      new Style({
        fill: new Fill({
          color: 'rgba(255, 255, 255, 0.5)',
        }),
        stroke: new Stroke({
          color: 'rgb(129, 131, 133)',
          width: 3.5,
        }),
        text: new Text({
          text: (feature.getProperties() as any).sd_ref, // Adjust property access as needed
          font: '12px Calibri,sans-serif',
          fill: new Fill({
            color: '#000',
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2,
          }),
          offsetY: -10,
          textAlign: 'center',
        }),
      }),
    ];
  };

  const boundaryVectorLayer = new VectorLayer({
    source: boundaryVectorSource,
    style: styleFunction,
  });


    const farmlandVectorSource = new VectorSource();
    const farmlandVectorLayer = new VectorLayer({
      source: farmlandVectorSource,
      style: (feature: FeatureLike) =>
        defaultStyle(feature as Feature<Geometry>),
    });

    const popup = new Overlay({
      element: popupContainer.current!,
      positioning: "bottom-center",
      stopEvent: false,
      offset: [0, -15],
    });

    const extent = [
      120870.33011448634, 526035.2936696329, 1754588.7855050964,
      1630624.3212196166,
    ]; // Define the extent here

    const mapInstance = new Map({
      controls: defaultControls().extend([
        new FullScreen({
          tipLabel: "Full Screen Mode",
        }),
        new ZoomToExtent({
          extent: extent,
          label: "E",
          tipLabel: "Zoom to Extent",
        }),
      ]),
      target: "map",
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        boundaryVectorLayer,
        farmlandVectorLayer,
      ],
      view: new View({
        center: fromLonLat([6.3792, 7.5244]),
        zoom: 6,
      }),
      overlays: [popup],
    });
    const select = new Select({
      condition: click,
      style: new Style({
        fill: new Fill({
          color: "rgba(0, 255, 255, 0.3)", // Transparent cyan color
        }),
        stroke: new Stroke({
          color: "#000", // Dark outline
          width: 3,
        }),
      }),
    });

    mapInstance.addInteraction(select);

    mapInstance.on("click", (event) => {
      var coordinates = event.coordinate;
      console.log("Clicked coordinates:", coordinates);
      const feature = mapInstance.forEachFeatureAtPixel(
        event.pixel,
        (feature: FeatureLike) => {
          return feature as Feature<Geometry>;
        }
      );

      if (
        feature &&
        (mapInstance.getLayers().getArray().includes(farmlandVectorLayer) ||
          mapInstance.getLayers().getArray().includes(boundaryVectorLayer))
      ) {
        const geometry = feature.getGeometry();
        if (geometry && geometry.getType() === "MultiPolygon") {
          const coordinates = (geometry as any).getCoordinates();
          const area = getArea(geometry);
          const hectares = (area / 10000).toFixed(2);
          const properties = feature.getProperties();

          // Remove the geometry property
          delete properties.geometry;

          // Create content by iterating over the properties
          let content = "";
          for (const [key, value] of Object.entries(properties)) {
            content += `<p><strong>${key.replace(
              /_/g,
              " "
            )}:</strong> ${value}</p>`;
          }

          // Add the calculated area as well
          content += `<p><strong>Size:</strong> ${hectares} hectares</p>`;

          if (popupContainer.current) {
            popupContainer.current.innerHTML = content;
            popup.setPosition(event.coordinate);
          }

          const extent = boundingExtent(coordinates[0][0]);
          mapInstance
            .getView()
            .fit(extent, { duration: 1000, padding: [250, 250, 250, 250] });
        } else {
          popup.setPosition(undefined);
        }
      } else {
        popup.setPosition(undefined);
      }
    });

    setMap(mapInstance);

    return () => {
      if (mapInstance) {
        mapInstance.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    const fetchAndAddLayer = (url: string, layerIndex: number) => {
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          const format = new GeoJSON();
          const features = format.readFeatures(data, {
            featureProjection: "EPSG:3857",
          });

          const layer = map.getLayers().item(layerIndex);
          if (layer instanceof VectorLayer) {
            const source = layer.getSource();
            if (source instanceof VectorSource) {
              source.clear();
              source.addFeatures(features);
            } else {
              console.error(
                `Layer at index ${layerIndex} does not have a VectorSource`
              );
            }
          } else {
            console.error(`Layer at index ${layerIndex} is not a VectorLayer`);
          }
        })
        .catch((error) =>
          console.error(`Error fetching data from ${url}:`, error)
        );
    };

    fetchAndAddLayer("/api/senatorial_boundaries", 1);
    fetchAndAddLayer("/api/farmlands", 2);
  }, [map]);
  return (
    <div>
      <div id="map" style={{ width: "100%", height: "85vh" }}></div>
      <div ref={popupContainer} className="ol-popup"></div>
    </div>
  );
};

export default MapComponent;
