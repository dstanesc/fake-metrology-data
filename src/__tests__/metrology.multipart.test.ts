import { 
    byteSize,
    multipartReport,
} from '../metrology'

import * as assert from 'assert';

describe("Assembly (multipart) metrology report", function () {
    test("Debug", () => {
       const reportData = multipartReport({ assemblySize: 10, minReportSize: 500, maxReportSize: 1000})
       const reportText = JSON.stringify(reportData, null, 2);
       //console.log(reportText)
       console.log(`Report size ${byteSize(reportText)} bytes`);
       assert.equal(10, Object.keys(reportData.partReports).length);
    });
});