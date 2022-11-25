import { ModelData } from "../model/model";

export class Engine {
    serverGameModels: ModelData[] = [];
    constructor(data: ModelData[]) {
        this.serverGameModels = data;
    }

}