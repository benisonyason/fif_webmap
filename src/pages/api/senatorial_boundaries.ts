import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../lib/db';
import { FeatureCollection, Feature, Polygon } from 'geojson'; // Import Feature and Polygon types

interface Boundary {
  sd_ref: string;
  adm1_en: string;
  infras: number;
  numwards: number;
  geom: GeoJSON.Polygon; // Assuming the geometry type is Polygon
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await pool.connect();
    const result = await client.query<Boundary>('SELECT sd_ref, adm1_en, infras, numwards, ST_AsGeoJSON(geom)::json AS geom FROM public.senatorial_boundary');
    client.release();

    // Format data as GeoJSON FeatureCollection
    const features: Feature<Polygon, { sd_ref: string; adm1_en: string, infras: number, numwards: number, }>[] = result.rows.map(row => {
      const geometry = row.geom;
      const properties = {
        sd_ref: row.sd_ref,
        adm1_en: row.adm1_en,
        infras: row.infras,
        numwards: row.numwards,
        // Add more properties as needed
      };
      return {
        type: 'Feature',
        geometry: geometry,
        properties: properties
      };
    });

    const featureCollection: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: features
    };

    res.status(200).json(featureCollection);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
