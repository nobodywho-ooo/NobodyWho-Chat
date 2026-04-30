export interface Model {
  id: number;
  modelName: string;
  modelSizeGB: number;
  parameterCountBillions: number;
  author: string;
  fileName: string;
  downloadURL: string;
  tags: string[];
}
