import { 
    byteSize,
    partReports
} from '../metrology'

import * as assert from 'assert';

describe("Subtle variation in 2 metrology reports", function () {
    test("Debug", () => {
       const reportsData = partReports({reportSize: 3})
       const r1 = reportsData.one
       const r2 = reportsData.two
       const r1Text = JSON.stringify(r1, null, 2);
       const r2Text = JSON.stringify(r2, null, 2);
       console.log(r1Text)
       console.log(r2Text);
       assert.notEqual(r1, r2);
    });
});