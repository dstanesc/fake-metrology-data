import { 
    byteSize,
    partReport
} from '../metrology'

import * as assert from 'assert';

describe("Part metrology report", function () {
    test("Debug", () => {
       const reportData = partReport({reportSize: 300})
       const reportText = JSON.stringify(reportData, null, 2);
       //console.log(reportText)
       console.log(`Report size ${byteSize(reportText)} bytes`);
       assert.equal(300, reportData.currentSample.dimensions);
    });
});