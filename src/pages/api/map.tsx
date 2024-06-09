import React, { useState, useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat } from 'ol/proj';
import { Fill, Stroke, Style, Text } from 'ol/style';
import Overlay from 'ol/Overlay';
import Select from 'ol/interaction/Select';
import { click } from 'ol/events/condition';
import 'ol/ol.css';
import { getArea } from 'ol/sphere';
import { boundingExtent } from 'ol/extent';
import Feature from 'ol/Feature';
import Geometry from 'ol/geom/Geometry';
import {FullScreen, defaults as defaultControls} from 'ol/control.js';

const MapComponent: React.FC = () => {
  const [map, setMap] = useState<Map | null>(null);
  const popupContainer = useRef<HTMLDivElement | null>(null);

  const highlightStyle = new Style({
    stroke: new Stroke({
      color: '#00f',
      width: 3,
    }),
    fill: new Fill({
      color: 'rgba(0, 0, 255, 0.1)',
    }),
  });

  const defaultStyle = (feature: Feature<Geometry>) => new Style({
    fill: new Fill({
      color: 'rgba(173, 216, 230, 0.5)', // Light blue fill color with opacity
    }),
    stroke: new Stroke({
      color: '#008000', // Green stroke color
      width: 3, // Stroke width
    }),
    text: new Text({
      text: feature.getProperties().uniq_id, // Label text based on uniq_id property
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
  });

  useEffect(() => {
    const boundaryVectorSource = new VectorSource();
    const boundaryVectorLayer = new VectorLayer({
      source: boundaryVectorSource,
      style: (feature: Feature<Geometry>) => {
        return [
          new Style({
            fill: new Fill({
              color: 'rgba(255, 255, 255, 0.5)',
            }),
            stroke: new Stroke({
              color: '#ff6347',
              width: 3.5,
            }),
            text: new Text({
              text: feature.getProperties().sd_ref,
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
      },
    });

    const farmlandVectorSource = new VectorSource();
    const farmlandVectorLayer = new VectorLayer({
      source: farmlandVectorSource,
      style: (feature: Feature<Geometry>) => defaultStyle(feature),
    });

    const popup = new Overlay({
      element: popupContainer.current!,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -15],
    });

    const mapInstance = new Map({
      controls: defaultControls().extend([new FullScreen()]),
      target: 'map',
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
          color: 'rgba(0, 255, 255, 0.3)', // Transparent cyan color
        }),
        stroke: new Stroke({
          color: '#000', // Dark outline
          width: 3,
        }),
      }),
    });
    
    mapInstance.addInteraction(select);

    mapInstance.on('click', (event) => {
      const feature = mapInstance.forEachFeatureAtPixel(event.pixel, (feature: Feature<Geometry>) => {
        return feature;
      });

      if (feature && mapInstance.getLayers().getArray().includes(farmlandVectorLayer, boundaryVectorLayer)) {
        if (feature.getGeometry().getType() === 'MultiPolygon') {
            const coordinates = feature.getGeometry().getCoordinates();
            const area = getArea(feature.getGeometry());
            const hectares = (area / 10000).toFixed(2);
            const properties = feature.getProperties();
            
            // Remove the geometry property
            delete properties.geometry;
            
            // Create content by iterating over the properties
            let content = '';
            for (const [key, value] of Object.entries(properties)) {
                content += `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`;
            }
            
            // Add the calculated area as well
            content += `<p><strong>Size:</strong> ${hectares} hectares</p>`;
            
            popupContainer.current!.innerHTML = content;
            popup.setPosition(event.coordinate);
    
            const extent = boundingExtent(coordinates[0][0]);
            mapInstance.getView().fit(extent, { duration: 1000, padding: [250, 250, 250, 250] });
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

    fetch('/api/senatorial_boundaries')
      .then((response) => response.json())
      .then((data) => {
        const format = new GeoJSON();
        const features = format.readFeatures(data, {
          featureProjection: 'EPSG:3857',
        });

        const boundaryVectorLayer = map.getLayers().item(1) as VectorLayer<VectorSource>;
        const boundarySource = boundaryVectorLayer.getSource() as VectorSource;
        boundarySource.clear();
        boundarySource.addFeatures(features);
      })
      .catch((error) => console.error('Error fetching boundary data:', error));

    fetch('/api/farmlands')
      .then((response) => response.json())
      .then((data) => {
        const format = new GeoJSON();
        const features = format.readFeatures(data, {
          featureProjection: 'EPSG:3857',
        });

        const farmlandVectorLayer = map.getLayers().item(2) as VectorLayer<VectorSource>;
        const farmlandSource = farmlandVectorLayer.getSource() as VectorSource;
        farmlandSource.clear();
        farmlandSource.addFeatures(features);
      })
      .catch((error) => console.error('Error fetching farmland data:', error));
  }, [map]);

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '85vh' }}></div>
      <div ref={popupContainer} className="ol-popup"></div>
    </div>
  );
};

export default MapComponent;
