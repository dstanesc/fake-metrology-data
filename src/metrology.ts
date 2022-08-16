import fs from 'fs'
import { faker } from '@faker-js/faker';
import { v4 as uuid } from 'uuid';
import { Buffer } from 'buffer';

export function byteSize(text: string) {
    return Buffer.byteLength(text, 'utf8')
}

/**
 * Metadata for multi-part (assembly) report generation
 */
export interface MultipartMeta {
    /**
     *  Number of parts to be generated
     */
    assemblySize: number

    /**
     *  Minimum number of measurements to be generated for the individual parts
     */
    minReportSize: number

    /**
     *  Maximum number of measurements to be generated for the individual parts
     */
    maxReportSize: number
}

/**
 * Metadata for part report generation
 */
export interface PartMeta {

    /**
     *  Number of measurements to be generated
     */
    reportSize: number
}


/**
 * Generate a synthetic multipart metrology report. The report would include
 * 
 * @param  {MultipartMeta} meta  Metadata for multi-part (assembly) report generation
 * @return {Object}       A JSON object containing a multipart metrology report
 */

export function multipartReport(meta: MultipartMeta): any {
    const partReports = Array(meta.assemblySize).fill(0).map(elem => {
        const reportSize = faker.datatype.number({ min: meta.minReportSize, max: meta.maxReportSize })
        const entry = { key: faker.vehicle.vrm(), value: partReport({ reportSize }) }
        return entry
    }).reduce(function (acc, cur, i) {
        acc[cur.key] = cur.value;
        return acc;
    }, {});
    return {
        partReports
    }
}

/**
 * Generate multiple synthetic multipart metrology reports with minor variations.
 * 
 * @param  {PartMeta} meta  Metadata for part report generation
 * @return {Object}     A JSON object containing 2, only slightly different metrology reports
 */
export function partReports(meta: PartMeta): any {
    return partReportInternal(meta);
}

/**
 * Generate a synthetic multipart metrology report.
 * 
 * @param  {PartMeta} meta  Metadata for part report generation
 * @return {Object}      A JSON object containing a single part metrology report
 */
export function partReport(meta: PartMeta): any {
    return partReportInternal(meta).one;
}

function partReportInternal(meta: PartMeta) {
    const timeMillis = Date.now();
    const eventStart = faker.datatype.datetime({ min: timeMillis - 200, max: timeMillis - 100 });
    const eventEnd = faker.datatype.datetime({ min: timeMillis + 100 * meta.reportSize, max: timeMillis + 300 * meta.reportSize });
    const events = Array(meta.reportSize).fill(0).map(elem => { return { "Timestamp": faker.date.between(eventStart, eventEnd), "Status": faker.helpers.arrayElement(['PartProgramStarted', 'Running', 'Waiting', 'IdleWaiting', 'PartProgramEnded']) }; });
    const runInfo = {
        sessionGuid: uuid(),
        routineGuid: uuid(),
        versionInfoObjectId: uuid(),
        versionInfoComponentID: faker.vehicle.manufacturer() + "-" + faker.hacker.noun() + "-" + faker.system.semver(),
        partName: faker.vehicle.vrm(),
        latestMachine: faker.lorem.slug(),
        iotDeviceId: uuid(),
        parentObjectId: uuid(),
        eventStart: eventStart,
        eventEnd: eventEnd,
        timestamp: faker.date.between(eventStart, eventEnd),
        events: events
    };
    const m1 = generateMeasurements(runInfo, meta);
    const m2 = [...m1];
    m2.push(generateMeasurement(runInfo, meta, Date.now(), m1.length, "Circle"));
    const warningData = m1.filter(measureInfo => measureInfo.location.oTol > 0).map(measureInfo => {
        return {
            "featureGuid": measureInfo.featureGuid,
            "shortName": measureInfo.featureId,
            "criticalWarningPercentage": 60,
            "nonCriticalWarningPercentage": 90,
            "isCriticalWarning": null,
            "isNonCriticalWarning": true,
            "deviation": measureInfo.location.deviation
        };
    });
    runInfo["warningData"] = warningData;
    const dimensionResults = m1.map(measureInfo => dimensionResultGenerator(measureInfo));
    const featureResults = m1.map(measureInfo => featureResultGenerator(measureInfo));
    const one = {
        "currentSample": currentSampleGenerator(runInfo, m1),
        "dimensionResults": dimensionResults,
        "featureResults": featureResults
    };
    const two = {
        "currentSample": currentSampleGenerator(runInfo, m2),
        "dimensionResults": dimensionResults,
        "featureResults": featureResults
    };
    return { one, two };
}

export function generateMeasurements(runInfo: any, meta: any): any {
    const measurements = []
    const timeMillis = Date.now();
    for (let index = 0; index < meta.reportSize; index++) {
        const featureType = faker.helpers.arrayElement(['Point', 'Line', 'Circle']);
        const measureInfo = generateMeasurement(runInfo, meta, timeMillis, index, featureType)
        measurements.push(measureInfo)
    }
    return measurements
}

export function generateMeasurement(runInfo: any, meta: any, timeMillis: number, index: number, featureType: string) {
    return {
        runInfo: runInfo,
        operatorName: faker.name.fullName(),
        location: generateLocation(meta),
        runEnd: faker.datatype.datetime({ min: timeMillis + 100 * index, max: timeMillis + 200 * index }),
        orderIndex: index,
        featureGuid: uuid(),
        featureId: faker.hacker.adjective() + '-' + faker.hacker.noun(),
        featureType: featureType,
        propertiesObjectId: uuid(),
        deviceId: runInfo.iotDeviceId + "-" + `HMISystem0-MeasurementSW0-MeasurementRoutine${faker.datatype.number(100)}-MeasurementFeature${index}`,
        timestamp: faker.datatype.datetime({ min: timeMillis - 200 * index, max: timeMillis - 100 * index }),
        indexedAt: faker.datatype.datetime({ min: timeMillis - 100 * index, max: timeMillis - 50 * index }),
        enqueuedTime: faker.datatype.datetime(timeMillis),
        objectId: uuid(),
        data: generateMeasureData(meta, featureType)
    };
}

export function currentSampleGenerator(runInfo: any, measurements: any): any {
    const featuresOutOfTolerance = measurements.filter(measureInfo => measureInfo.location.oTol > 0).length
    const featuresInTolerance = measurements.filter(measureInfo => measureInfo.location.oTol === 0).length
    const currentSample = {
        "runId": runInfo.sessionGuid,
        "name": runInfo.versionInfoComponentID,
        "routineGuid": runInfo.routineGuid,
        "runDate": runInfo.timestamp,
        "runEnd": runInfo.eventEnd,
        "status": runInfo.warningData.length > 0 ? "Failed" : "Succeeded",
        "metrologyClient": "Pcdmis",
        "latestRun": JSON.stringify(latestRunGenerator(runInfo, measurements)),
        "dimensions": measurements.length,
        "inTolerance": featuresInTolerance,
        "outOfTolerance": featuresOutOfTolerance,
        "warning": runInfo.warningData.length,
        "warningData": runInfo.warningData
    }
    return currentSample
}

export function latestRunGenerator(runInfo: any, measurements: any): any {
    const featuresOutOfTolerance = measurements.filter(measureInfo => measureInfo.location.oTol > 0).length
    const featuresInTolerance = measurements.filter(measureInfo => measureInfo.location.oTol === 0).length
    const latestRun = {
        "Status": "PartProgramCompleted",
        "ParentObjectID": runInfo.parentObjectId,
        "EventStart": runInfo.eventStart,
        "EventEnd": runInfo.eventEnd,
        "EventType": "PartProgramCompleted",
        "IdealTime": "00:08:24",
        "ExecutionDuration": "00:29:47.2809170",
        "OeeDataType": "Ended",
        "ExecutionGuid": runInfo.sessionGuid,
        "EndEventObjectID": measurements[measurements.length - 1].objectId,
        "OEEVerified": true,
        "ObjectID": measurements[measurements.length - 1].objectId,
        "DeviceID": measurements[measurements.length - 1].deviceId,
        "IoTDeviceID": runInfo.iotDeviceId,
        "DeviceClass": "OEEData",
        "MessageType": "Telemetry",
        "DayID": "637914941763445431",
        "ActiveRoutineDeviceID": runInfo.iotDeviceId,
        "RoutineName": runInfo.versionInfoComponentID,
        "RoutineGuid": runInfo.routineGuid,
        "InScheduleTime": "00:00:00",
        "UtcOffset": 1.0,
        "Timestamp": runInfo.timestamp,
        "Events": runInfo.events,
        "IdleWaitingInSchedule": "00:00:00",
        "NumberOfFeaturesOutOfTolerance": featuresOutOfTolerance,
        "NumberOfFeaturesInTolerance": featuresInTolerance,
        "MeasurementSession": {
            "PartDimensions": 0,
            "TraceValues": runInfo.partName,
            "TraceTypes": "PartName"
        },
        "HasUploadedReports": true
    }
    return latestRun
}

export function generateMeasureData(meta: any, featureType: string): any {
    let data
    switch (featureType) {
        case "Circle":
            const angleI = Math.random()
            const angleJ = Math.random()
            const angleK = Math.random()
            const centerX = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const centerY = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const centerZ = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const diameter = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            data = {
                nominalCenterX: centerX,
                nominalCenterY: centerY,
                nominalCenterZ: centerZ,
                measuredCenterX: faker.datatype.number({ min: centerX - 1, max: centerX + 1, precision: 0.000000000000001 }),
                measuredCenterY: faker.datatype.number({ min: centerY - 1, max: centerY + 1, precision: 0.000000000000001 }),
                measuredCenterZ: faker.datatype.number({ min: centerZ - 1, max: centerZ + 1, precision: 0.000000000000001 }),
                nominalDiameter: diameter,
                measuredDiameter: faker.datatype.number({ min: diameter - 1, max: diameter + 1, precision: 0.000000000000001 }),
                nominalAngleVectorI: angleI,
                nominalAngleVectorJ: angleJ,
                nominalAngleVectorK: angleK
            };
            break;
        case "Line":
            const normalI = Math.random()
            const normalJ = Math.random()
            const normalK = Math.random()
            const startX = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const startY = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const startZ = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const endX = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const endY = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const endZ = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })

            data = {
                measuredNormalI: faker.datatype.number({ min: normalI - 0.1, max: normalI + 0.1, precision: 0.000000000000001 }),
                measuredNormalJ: faker.datatype.number({ min: normalJ - 0.1, max: normalJ + 0.1, precision: 0.000000000000001 }),
                measuredNormalK: faker.datatype.number({ min: normalK - 0.1, max: normalK + 0.1, precision: 0.000000000000001 }),
                nominalNormalI: normalI,
                nominalNormalJ: normalJ,
                nominalNormalK: normalK,
                measuredStartX: faker.datatype.number({ min: startX - 1, max: startX + 1, precision: 0.000000000000001 }),
                measuredStartY: faker.datatype.number({ min: startY - 1, max: startY + 1, precision: 0.000000000000001 }),
                measuredStartZ: faker.datatype.number({ min: startZ - 1, max: startZ + 1, precision: 0.000000000000001 }),
                nominalStartX: startX,
                nominalStartY: startY,
                nominalStartZ: startZ,
                measuredEndX: faker.datatype.number({ min: endX - 1, max: endX + 1, precision: 0.000000000000001 }),
                measuredEndY: faker.datatype.number({ min: endY - 1, max: endY + 1, precision: 0.000000000000001 }),
                measuredEndZ: faker.datatype.number({ min: endZ - 1, max: endZ + 1, precision: 0.000000000000001 }),
                nominalEndX: endX,
                nominalEndY: endY,
                nominalEndZ: endZ,
            };
            break;
        case "Point":
            const x = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const y = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            const z = faker.datatype.number({ min: 10, max: 1000, precision: 0.000000000000001 })
            data = {
                measuredX: faker.datatype.number({ min: x - 1, max: x + 1, precision: 0.000000000000001 }),
                measuredY: faker.datatype.number({ min: y - 1, max: y + 1, precision: 0.000000000000001 }),
                measuredZ: faker.datatype.number({ min: z - 1, max: z + 1, precision: 0.000000000000001 }),
                nominalX: x,
                nominalY: y,
                nominalZ: z
            };
            break;
        default: throw "Unknown feature type";
    }
    return data
}

export function generateLocation(meta: any): any {
    const name = faker.word.noun()
    const nominal = faker.datatype.float({ min: 10, max: 100, precision: 0.000000000000001 })
    const measured = faker.datatype.float({ min: nominal - 1, max: nominal + 1, precision: 0.000000000000001 })
    const tolerance = faker.datatype.float({ min: -1, max: 1, precision: 0.000000000000001 })
    const deviation = measured - nominal
    const oTol = Math.abs(deviation) - Math.abs(tolerance)
    const location = {
        name: name,
        nominal: nominal,
        measured: measured,
        tolerance: tolerance,
        deviation: deviation,
        oTol: oTol >= 0 ? oTol : 0
    }
    return location
}


export function dimensionResultGenerator(measureInfo: any): any {
    const objectId = uuid()
    const outOfTolerance = (measureInfo: any): boolean => {
        return Math.abs(measureInfo.location.deviation) > measureInfo.location.tolerance
    }
    const deviationPercentage = (measureInfo: any): number => {
        return (measureInfo.location.deviation + measureInfo.location.measured) / measureInfo.location.measured
    }
    const dimensionData = {
        "name": measureInfo.location.name,
        "metadata": null,
        "currentData": {
            "run": {
                "runId": measureInfo.runInfo.sessionGuid,
                "traceFields": [
                    {
                        "type": "PartName",
                        "value": measureInfo.runInfo.partName
                    },
                    {
                        "type": "Operator",
                        "value": measureInfo.operatorName
                    }
                ],
                "latestMachine": measureInfo.runInfo.latestMachine,
                "runEnd": measureInfo.runEnd,
                "warningSettings": "{\r\n  \"warningPercentNonCrit\": 90,\r\n  \"warningPercentCrit\": 60,\r\n  \"historyItemCount\": 10\r\n}"
            },
            "dimension": {
                "orderIndex": measureInfo.orderIndex,
                "objectId": objectId,
                "featureGuid": measureInfo.featureGuid,
                "iotDeviceId": measureInfo.runInfo.iotDeviceId,
                "runId": measureInfo.runInfo.sessionGuid,
                "shortName": measureInfo.location.name,
                "isOutOfTolerance": outOfTolerance(measureInfo),
                "evaluation": outOfTolerance(measureInfo) ? "OutOfTolerance" : "InTolerance",
                "deviation": measureInfo.location.deviation.toString(),
                "bonusVal": null,
                "measured": measureInfo.location.measured.toString(),
                "measurement": {
                    "Measured": measureInfo.location.measured,
                    "MeasuredMin": null,
                    "MeasuredMax": null,
                    "Specification": "⌜",
                    "SpecificationFont": null,
                    "Features": measureInfo.featureId,
                    "FeatureTypes": measureInfo.featureType,
                    "DimensionType": "Location",
                    "Deviation": measureInfo.location.deviation,
                    "OTol": measureInfo.location.oTol,
                    "BonusVal": null,
                    "IsOutOfTolerance": outOfTolerance(measureInfo),
                    "RoutineGuid": measureInfo.runInfo.routineGuid,
                    "Nominal": measureInfo.location.nominal,
                    "CommandID": measureInfo.location.name,
                    "VersionInfoObjectID": measureInfo.runInfo.versionInfoObjectId,
                    "VersionInfoComponentID": measureInfo.runInfo.versionInfoComponentId,
                    "USL": 0.05,
                    "LSL": -0.05,
                    "UWL": null,
                    "LWL": null,
                    "Evaluation": outOfTolerance(measureInfo) ? "OutOfTolerance" : "InTolerance",
                    "Units": "Millimeters",
                    "Algorithm": "Unknown",
                    "Standard": "Unknown",
                    "ExecutionGuid": measureInfo.runInfo.sessionGuid,
                    "MessageType": "Event",
                    "PropertiesObjectID": measureInfo.propertiesObjectId,
                    "Status": "Info",
                    "EventDescription": "Dimension" + "-" + measureInfo.location.name,
                    "EventType": outOfTolerance(measureInfo) ? "FeatureFailed" : "FeaturePassed",
                    "FaultCause": null,
                    "FaultSolution": null,
                    "Disabled": null,
                    "DeviceID": measureInfo.deviceId,
                    "IoTDeviceID": measureInfo.runInfo.iotDeviceId,
                    "ObjectID": objectId,
                    "ParentObjectID": measureInfo.runInfo.parentObjectId,
                    "Timestamp": measureInfo.timestamp,
                    "DeviceClass": "MeasurementFeature",
                    "DeviceType": "MeasurementFeatureGeneric",
                    "IndexedAt": measureInfo.indexedAt,
                    "EnqueuedTime": measureInfo.enqueuedTime,
                    "SourcePartition": "30",
                    "Location": "Shop Floor"
                },
                "failedNelsonRules": [],
                "failedNelsonRuleIds": [],
                "deviationPercentage": deviationPercentage(measureInfo),
                "schema": 2
            }
        },
        "pastData": []
    }
    return dimensionData;
}

export function featureResultGenerator(measureInfo: any): any {
    let measurement = featureMeasurementGeneratorByType(measureInfo);
    const featureData = {
        "featureGuid": measureInfo.featureGuid,
        "runId": measureInfo.runInfo.sessionGuid,
        "measurementSoftwareGuid": measureInfo.runInfo.versionInfoObjectId,
        "routineGuid": measureInfo.runInfo.routineGuid,
        "shortName": measureInfo.featureId,
        "featureType": measureInfo.featureType,
        "jsonData": JSON.stringify(measurement)
    }
    return featureData
}

function featureMeasurementGeneratorByType(measureInfo: any) {
    const featureType = measureInfo.featureType;
    let measurement;
    switch (featureType) {
        case "Circle":
            measurement = featureMeasurementGeneratorCircle(measureInfo);
            break;
        case "Line":
            measurement = featureMeasurementGeneratorLine(measureInfo);
            break;
        case "Point":
            measurement = featureMeasurementGeneratorPoint(measureInfo);
            break;
        default: throw "Unknown feature type";
    }
    return measurement;
}

export function featureMeasurementGeneratorGeneric(measureInfo: any): any {
    return {
        "RoutineGuid": measureInfo.runInfo.routineGuid,
        "ExecutionGuid": null,
        "CommandId": null,
        "VersionInfoObjectID": measureInfo.runInfo.versionInfoObjectId,
        "VersionInfoComponentID": measureInfo.runInfo.versionInfoComponentId,
        "Description": measureInfo.featureId + ' Measured on:  MOF_2022_2.PRG',
        "FeatureType": measureInfo.featureType,
        "FeatureGuid": measureInfo.featureGuid,
        "SessionGuid": measureInfo.runInfo.sessionGuid,
        "FeatureId": measureInfo.featureId,
        "MessageType": "Event",
        "PropertiesObjectID": measureInfo.propertiesObjectId,
        "Status": "Info",
        "EventDescription": measureInfo.featureId + ' Measured on:  MOF_2022_2.PRG',
        "EventType": "FeatureMeasured",
        "FaultCause": null,
        "FaultSolution": null,
        "Disabled": null,
        "DeviceID": measureInfo.deviceId,
        "IoTDeviceID": measureInfo.runInfo.iotDeviceId,
        "ObjectID": measureInfo.objectId,
        "ParentObjectID": measureInfo.runInfo.parentObjectId,
        "Timestamp": measureInfo.timestamp,
        "DeviceClass": "MeasuredFeature",
        "DeviceType": "Circle",
        "IndexedAt": measureInfo.indexedAt,
        "EnqueuedTime": measureInfo.enqueuedTime,
        "SourcePartition": "30",
        "Location": "Shop Floor"
    }
}

export function featureMeasurementGeneratorPoint(measureInfo: any): any {
    const measurement = featureMeasurementGeneratorGeneric(measureInfo)
    const pointData = {
        "MeasuredNormalI": 0.0,
        "MeasuredNormalJ": 0.0,
        "MeasuredNormalK": 1.0,
        "MeasuredX": measureInfo.data.measuredX,
        "MeasuredY": measureInfo.data.measuredY,
        "MeasuredZ": measureInfo.data.measuredZ,
        "NominalNormalI": 0.0,
        "NominalNormalJ": 0.0,
        "NominalNormalK": 1.0,
        "NominalX": measureInfo.data.nominalX,
        "NominalY": measureInfo.data.nominalY,
        "NominalZ": measureInfo.data.nominalZ,
        "NominalCenterX": 0.0,
        "NominalCenterY": 0.0,
        "NominalCenterZ": 0.0,
        "MeasuredCenterX": 0.0,
        "MeasuredCenterY": 0.0,
        "MeasuredCenterZ": 0.0,
        "NominalDiameter": 0.0,
        "MeasuredDiameter": 0.0,
        "NominalLength": 0.0,
        "MeasuredLength": 0.0,
        "NominalStartX": 0.0,
        "NominalStartY": 0.0,
        "NominalStartZ": 0.0,
        "NominalEndX": 0.0,
        "NominalEndY": 0.0,
        "NominalEndZ": 0.0,
        "MeasuredStartX": 0.0,
        "MeasuredStartY": 0.0,
        "MeasuredStartZ": 0.0,
        "MeasuredEndX": 0.0,
        "MeasuredEndY": 0.0,
        "MeasuredEndZ": 0.0,
        "NominalAngleVectorI": 0.0,
        "NominalAngleVectorJ": 0.0,
        "NominalAngleVectorK": 0.0,
        "NominalStartAngle": 0.0,
        "NominalEndAngle": 0.0,
        "NominalInternal": false,
        "MeasuredStartAngle": 0.0,
        "MeasuredEndAngle": 0.0,
        "NominalMajorDiameter": 0.0,
        "NominalMinorDiameter": 0.0,
        "MeasuredMajorDiameter": 0.0,
        "MeasuredMinorDiameter": 0.0,
        "NominalWidth": 0.0,
        "MeasuredWidth": 0.0,
        "NominalNumberOfSides": 0
    }
    return Object.assign(measurement, pointData)
}

export function featureMeasurementGeneratorLine(measureInfo: any): any {
    const measurement = featureMeasurementGeneratorGeneric(measureInfo)
    const lineData = {
        "MeasuredNormalI": measureInfo.data.measuredNormalI,
        "MeasuredNormalJ": measureInfo.data.measuredNormalJ,
        "MeasuredNormalK": measureInfo.data.measuredNormalK,
        "MeasuredX": 0.0,
        "MeasuredY": 0.0,
        "MeasuredZ": 0.0,
        "NominalNormalI": measureInfo.data.nominalNormalI,
        "NominalNormalJ": measureInfo.data.nominalNormalJ,
        "NominalNormalK": measureInfo.data.nominalNormalJ,
        "NominalX": 0.0,
        "NominalY": 0.0,
        "NominalZ": 0.0,
        "NominalCenterX": 0.0,
        "NominalCenterY": 0.0,
        "NominalCenterZ": 0.0,
        "MeasuredCenterX": 0.0,
        "MeasuredCenterY": 0.0,
        "MeasuredCenterZ": 0.0,
        "NominalDiameter": 0.0,
        "MeasuredDiameter": 0.0,
        "NominalLength": 0.0,
        "MeasuredLength": 0.0,
        "NominalStartX": measureInfo.data.nominalStartX,
        "NominalStartY": measureInfo.data.nominalStartY,
        "NominalStartZ": measureInfo.data.nominalStartZ,
        "NominalEndX": measureInfo.data.nominalEndX,
        "NominalEndY": measureInfo.data.nominalEndY,
        "NominalEndZ": measureInfo.data.nominalEndZ,
        "MeasuredStartX": measureInfo.data.measuredStartX,
        "MeasuredStartY": measureInfo.data.measuredStartY,
        "MeasuredStartZ": measureInfo.data.measuredStartZ,
        "MeasuredEndX": measureInfo.data.measuredEndX,
        "MeasuredEndY": measureInfo.data.measuredEndY,
        "MeasuredEndZ": measureInfo.data.measuredEndZ,
        "NominalAngleVectorI": 0.0,
        "NominalAngleVectorJ": 0.0,
        "NominalAngleVectorK": 0.0,
        "NominalStartAngle": 0.0,
        "NominalEndAngle": 0.0,
        "NominalInternal": false,
        "MeasuredStartAngle": 0.0,
        "MeasuredEndAngle": 0.0,
        "NominalMajorDiameter": 0.0,
        "NominalMinorDiameter": 0.0,
        "MeasuredMajorDiameter": 0.0,
        "MeasuredMinorDiameter": 0.0,
        "NominalWidth": 0.0,
        "MeasuredWidth": 0.0,
        "NominalNumberOfSides": 0
    }
    return Object.assign(measurement, lineData)
}

export function featureMeasurementGeneratorCircle(measureInfo: any): any {
    const measurement = featureMeasurementGeneratorGeneric(measureInfo)
    const circleData = {
        "MeasuredNormalI": 0.0,
        "MeasuredNormalJ": 0.0,
        "MeasuredNormalK": 1.0,
        "MeasuredX": 0.0,
        "MeasuredY": 0.0,
        "MeasuredZ": 0.0,
        "NominalNormalI": 0.0,
        "NominalNormalJ": 0.0,
        "NominalNormalK": 1.0,
        "NominalX": 0.0,
        "NominalY": 0.0,
        "NominalZ": 0.0,
        "NominalCenterX": measureInfo.data.nominalCenterX,
        "NominalCenterY": measureInfo.data.nominalCenterY,
        "NominalCenterZ": measureInfo.data.nominalCenterZ,
        "MeasuredCenterX": measureInfo.data.measuredCenterX,
        "MeasuredCenterY": measureInfo.data.measuredCenterY,
        "MeasuredCenterZ": measureInfo.data.measuredCenterZ,
        "NominalDiameter": measureInfo.data.nominalDiameter,
        "MeasuredDiameter": measureInfo.data.measuredDiameter,
        "NominalLength": 0.0,
        "MeasuredLength": 0.0,
        "NominalStartX": 0.0,
        "NominalStartY": 0.0,
        "NominalStartZ": 0.0,
        "NominalEndX": 0.0,
        "NominalEndY": 0.0,
        "NominalEndZ": 0.0,
        "MeasuredStartX": 0.0,
        "MeasuredStartY": 0.0,
        "MeasuredStartZ": 0.0,
        "MeasuredEndX": 0.0,
        "MeasuredEndY": 0.0,
        "MeasuredEndZ": 0.0,
        "NominalAngleVectorI": measureInfo.data.nominalAngleVectorI,
        "NominalAngleVectorJ": measureInfo.data.nominalAngleVectorJ,
        "NominalAngleVectorK": measureInfo.data.nominalAngleVectorK,
        "NominalStartAngle": 0.0,
        "NominalEndAngle": 0.0,
        "NominalInternal": true,
        "MeasuredStartAngle": 0.0,
        "MeasuredEndAngle": 0.0,
        "NominalMajorDiameter": 0.0,
        "NominalMinorDiameter": 0.0,
        "MeasuredMajorDiameter": 0.0,
        "MeasuredMinorDiameter": 0.0,
        "NominalWidth": 0.0,
        "MeasuredWidth": 0.0,
        "NominalNumberOfSides": 0
    }
    return Object.assign(measurement, circleData)
}
