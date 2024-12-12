/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/record', 'N/runtime', 'N/query'],

    function(record, runtime, query) {

        // NS module utilities

        /**
         * Get all the data results in saved search
         * @param {nlobj} search netsuite saved search object
         * @return Search Results
         */
        function getResults(search) {
            let holder = [];
            let i = 0;
            while (true) {
                let result = search.getRange({
                    start: i,
                    end: i + 1000
                });
                if (!result) break;
                holder = holder.concat(result);
                if (result.length < 1000) break;
                i += 1000;
            }
            return holder;
        }

        /**
         * Checks if the transaction is standalone or not
         *
         * @param {object} [recordObj] - record object
         * @return {boolean} isStandAlone
         *
         */
        function isTransactionStandAlone(recordObj) {
            let isStandAlone = true;

            if (!isEmpty(recordObj)) {
                let recordId = recordObj.id;

                if (!isEmpty(recordId)) {
                    let queryStr = `SELECT ptl.previousdoc
                                FROM PreviousTransactionLink ptl 
                                INNER JOIN transaction tran
                                ON tran.id = ptl.nextdoc
                                WHERE tran.id = ${recordId}`;

                    let resultSuiteQL = query.runSuiteQL({
                        query: queryStr
                    }).asMappedResults();

                    isStandAlone = resultSuiteQL.length === 0;
                } else {

                    let queryString = recordObj.getValue('entryformquerystring');
                    let params = objectifyQueryString(queryString);

                    if (!isEmpty(params.bulktype)) isStandAlone = false;
                    if (!isEmpty(params.transform)) isStandAlone = false;
                }
            }
            return isStandAlone;
        }

        /**
         * Check if the subsidiary feature is enabled. If yes = OneWorld, no = single instance
         *
         * @function isOWA
         * @returns {boolean} Boolean value that indicates if the subsidiary feature is in effect or not
         */
        function isOWA () {
            return runtime.isFeatureInEffect({feature: 'SUBSIDIARIES'});
        }

        /**
         * fetches subsidiary timezone and dateformat
         *
         * @param {string|int} [subsidiaryId] - subsidiary Id
         *
         */
        function getSubsidiaryTimeZoneAndDateFormat(subsidiaryId) {
            let timezone = null;
            let dateformat = null;

            if (!isEmpty(subsidiaryId)) {
                let subsidiaryObj = record.load({
                    type: 'subsidiary',
                    id: subsidiaryId
                });
                timezone = subsidiaryObj.getValue('timezone');
                dateformat = subsidiaryObj.getValue('dateformat');
            }
            return {
                timezone: timezone,
                dateformat: dateformat
            };
        }

        /**
         * fetches the user timezone and dateformat
         *
         */
        function getUserTimeZoneAndDateFormat() {
            let userObj = runtime.getCurrentUser();
            let timezone = userObj.getPreference ('timezone');
            let dateformat = userObj.getPreference ('dateformat');

            return {
                timezone: timezone,
                dateformat: dateformat
            };
        }

        // JS utilities

        function isEmpty(value) {
            return ((value === 'none' || value === '' || value == null || value == undefined) || (value.constructor === Array && value.length == 0) ||
                (value.constructor === Object && (function (v) { for (let k in v) return false; return true; })(value)));
        }

        // merge two arrays into key-value pair
        function zipArrays (keysArray, valuesArray) {
            return Object.fromEntries(keysArray.map((value, index) => [value, valuesArray[index]]));
        }

        // retrieve key values and remove duplicates
        function uniqueByKey (arrObj, prop) {
            return arrObj.map((val) => val[prop]).filter(
                (elem, index, arr) => !isEmpty(elem) && index === arr.findIndex((t) => t === elem)
            );
        }

        // retrieve values and remove duplicates
        function uniqueByElement (arr) {
            return arr.filter((val, i, ar) => ar.indexOf(val) === i);
        }

        function groupBy(objectArray, property) {
            return objectArray.reduce(function (acc, obj) {
                let key = obj[property];
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(obj);
                return acc;
            }, {});
        }

        /**
         * Chunk Array
         * @param  {Array} arr
         * @param  {Integer}  val (set array by selected number of chunk)
         * Example
         * chunkArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2) => 5 sets (0: [1, 2,], 1: [3, 4], 2: [5, 6], 3: [7, 8], 4: [9, 10])
         */
        function chunkArray(arr, val) {
            let finalArr = [];
            for (let i = 0; i < arr.length; i += val) {
                finalArr.push(arr.slice(i, val + i));
            }

            return finalArr;
        }

        function roundDecimal (num, decimalPlaces = 0) {
            let p = Math.pow(10, decimalPlaces);
            let n = (num * p) * (1 + Number.EPSILON);
            return Math.round(n) / p;
        }

        // function roundDecimal(number, decimalPlace) {
        //     return (Math.round(number * 100) / 100).toFixed(decimalPlace);
        // }

        function numberWithCommas(number) {
            let parts = number.toString().split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return parts.join('.');
        }

        function formatCurrency(number, isForceDefault = true, decimalPlaces = null) {
            number = typeof number === 'string' ? number.replace(/\,/g,'') : number;
            let parts = number.toString().split('.');
            let formatted = '';
            if (!isForceDefault) {
                if (isEmpty(decimalPlaces)) {
                    if (parts.length > 1 && parts[1].length > 1) {
                        formatted = numberWithCommas(`${parts[0]}.${parts[1]}`);
                    } else {
                        formatted = numberWithCommas(roundDecimal(number, 2).toFixed(2));
                    }
                } else {
                    if (parts.length > 1 && parts[1].length > 1) {
                        formatted = numberWithCommas(`${parts[0]}.${parts[1]}`);
                    } else {
                        formatted = numberWithCommas(roundDecimal(number, decimalPlaces).toFixed(decimalPlaces));
                    }
                }
            } else {
                decimalPlaces = 2;
                formatted = numberWithCommas(roundDecimal(number, decimalPlaces).toFixed(decimalPlaces));
            }
            return formatted;
        }

        function parseNum(number, isPercentage = false, isInteger = false) {
            let value = 0;
            number = typeof number === 'string' ? number.replace(/\,/g,'') : number;
            if (!isEmpty(number)) {
                if (isInteger) {
                    value = parseInt(number);
                } else {
                    value = parseFloat(number);
                }
                if (isPercentage) {
                    value = value / 100;
                }
            }
            return value;
        }

        function objectifyQueryString(queryStr) {
            return queryStr.split("&").reduce(function(prev, curr, i, arr) {
                var p = curr.split("=");
                prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
                return prev;
            }, {});
        }

        // will be called by function amountToWords()
        function convertNumberToWords(amount = 0) {
            if (amount==0) return "Zero";
            amount = ("0".repeat(2 * (amount += "").length % 3) + amount).match(/.{3}/g);
            let out = "";
            let T1 = [
                "",
                "One",
                "Two",
                "Three",
                "Four",
                "Five",
                "Six",
                "Seven",
                "Eight",
                "Nine",
                "Ten",
                "Eleven",
                "Twelve",
                "Thirteen",
                "Fourteen",
                "Fifteen",
                "Sixteen",
                "Seventeen",
                "Eighteen",
                "Nineteen"
            ];
            let T2 = [
                "",
                "",
                "Twenty",
                "Thirty",
                "Forty",
                "Fifty",
                "Sixty",
                "Seventy",
                "Eighty",
                "Ninety"
            ];
            let SC = [
                "",
                "Thousand",
                "Million",
                "Billion",
                "Trillion",
                "Quadrillion"
            ];

            return amount.forEach((n,i) => {
                if (+n) {
                    let h =+ n[0];
                    let t =+ n.substring(1);
                    let S = SC[amount.length - i - 1];
                    out += (out ? " " : "") + (h ? T1[h] + " Hundred" : "") + (h && t? " " : "") + (t < 20 ? T1[t] :T2[+n[1]] + (+n[2] ? "-" : "") + T1[+n[2]]);
                    out += (out && S ? " " : "") + S;
                }
            }), out;
        }

        function amountToWords(n) {
            let nums = n.toString().split('.')
            let whole = convertNumberToWords(nums[0])
            if (nums.length == 2) {
                let fraction = nums[1] + "/100"
                return whole + ' and ' + fraction;
            } else {
                return whole;
            }
        }

        function decimalToHours(num) {
            let decimalTime = parseFloat(num);
            decimalTime = decimalTime * 60 * 60;
            let hours = Math.floor((decimalTime / (60 * 60)));
            decimalTime = decimalTime - (hours * 60 * 60);
            let minutes = Math.floor((decimalTime / 60));
            decimalTime = decimalTime - (minutes * 60);
            let seconds = Math.round(decimalTime);
            return hours + ":" + (minutes == 0 ? '00' : minutes);
        }

        function monthDiff(d1, d2, isExact = true, isRoundedOff = true) {
            let months = d2.getMonth() - d1.getMonth() + 12 * (d2.getFullYear() - d1.getFullYear());
            if (!isExact) {
                let diffdays = Math.abs((d1.getDate() - d2.getDate()) / 30); // 30 days
                diffdays = parseFloat((Math.round(diffdays * 100) / 100).toFixed(2));
                diffdays = isRoundedOff ? Math.round(diffdays) : diffdays;
                months += diffdays;
            }
            return months <= 0 ? 0 : months;
        }

        function pad(str, count, pad, isLeftPad = true) {
            if (str !== null || str !== undefined || str !== '') {
                str = str.toString();
                if (str.length < count) {
                    let loopCount = count - str.length;
                    let padding = "";
                    for (let i = 0; i < loopCount; i++) {
                        padding += pad;
                    }
                    return isLeftPad == true ? (padding + str) : (str + padding);
                } else {
                    return str;
                }
            }
        }

        function getEmailRecipients(emails, numberOfRecipients = 0) {
            let emailTo = [];
            let emailCC = [];

            if (isEmpty(emails)) emails = '';
            emails = emails.replace(/\s+/g, '');
            if (emails && emails.indexOf(';') > 0) {
                emails = emails.split(';');
            } else if (emails && emails.indexOf(',') > 0) {
                emails = emails.split(',');
            }
            if (typeof emails !== 'string') {
                for (let x = 0; x < emails.length; x++) {
                    if (!isEmpty(emails[x])) {
                        if (x <= numberOfRecipients) {
                            emailTo.push(emails[x]);
                        } else {
                            emailCC.push(emails[x]);
                        }
                    }
                }
            } else {
                if (!isEmpty(emails)) emailTo.push(emails);
            }

            return {
                emailTo: emailTo,
                emailCC: emailCC
            }
        }

        function CSVToArray( strData, strDelimiter ){
            strDelimiter = (strDelimiter || ",");
            let objPattern = new RegExp(
                (
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ),
                "gi"
            );
            let arrData = [[]];
            let arrMatches = null;

            // Remove UTF-8 byte order mark (BOM) if present
            strData = strData.replace(/^\uFEFF/, '');

            while (arrMatches = objPattern.exec(strData)) {
                let strMatchedDelimiter = arrMatches[1];
                if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
                    arrData.push( [] );
                }
                let strMatchedValue;
                if (arrMatches[2]) {
                    strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"),
                        "\""
                    );
                } else {
                    strMatchedValue = arrMatches[3];
                }

                arrData[arrData.length - 1].push(strMatchedValue);
            }
            arrData = arrData.filter(val => !val.every(element => isEmpty(element)));
            return(arrData);
        }


        function getCountryByCode(code) {
            let arrcountry = new Array();
            arrcountry[0] = new Array("AF",3);
            arrcountry[1] = new Array("AX",247);
            arrcountry[2] = new Array("AL",6);
            arrcountry[3] = new Array("DZ",62);
            arrcountry[4] = new Array("AS",12);
            arrcountry[5] = new Array("AD",1);
            arrcountry[6] = new Array("AO",9);
            arrcountry[7] = new Array("AI",5);
            arrcountry[8] = new Array("AQ",10);
            arrcountry[9] = new Array("AG",4);
            arrcountry[10] = new Array("AR",11);
            arrcountry[11] = new Array("AM",7);
            arrcountry[12] = new Array("AW",15);
            arrcountry[13] = new Array("AU",14);
            arrcountry[14] = new Array("AT",13);
            arrcountry[15] = new Array("AZ",16);
            arrcountry[16] = new Array("BS",31);
            arrcountry[17] = new Array("BH",23);
            arrcountry[18] = new Array("BD",19);
            arrcountry[19] = new Array("BB",18);
            arrcountry[20] = new Array("BY",35);
            arrcountry[21] = new Array("BE",20);
            arrcountry[22] = new Array("BZ",36);
            arrcountry[23] = new Array("BJ",25);
            arrcountry[24] = new Array("BM",27);
            arrcountry[25] = new Array("BT",32);
            arrcountry[26] = new Array("BO",29);
            arrcountry[27] = new Array("BA",27);
            arrcountry[28] = new Array("BW",34);
            arrcountry[29] = new Array("BV",33);
            arrcountry[30] = new Array("BR",30);
            arrcountry[31] = new Array("IO",106);
            arrcountry[32] = new Array("BN",28);
            arrcountry[33] = new Array("BG",22);
            arrcountry[34] = new Array("BF",21);
            arrcountry[35] = new Array("BI",24);
            arrcountry[36] = new Array("KH",117);
            arrcountry[37] = new Array("CM",46);
            arrcountry[38] = new Array("CA",37);
            arrcountry[39] = new Array("IC",249);
            arrcountry[40] = new Array("CV",53);
            arrcountry[41] = new Array("KY",124);
            arrcountry[42] = new Array("CF",40);
            arrcountry[43] = new Array("EA",248);
            arrcountry[44] = new Array("TD",212);
            arrcountry[45] = new Array("CL",45);
            arrcountry[46] = new Array("CN",47);
            arrcountry[47] = new Array("CX",54);
            arrcountry[48] = new Array("CC",38);
            arrcountry[49] = new Array("CO",48);
            arrcountry[50] = new Array("KM",119);
            arrcountry[51] = new Array("CD",39);
            arrcountry[52] = new Array("CG",41);
            arrcountry[53] = new Array("CK",44);
            arrcountry[54] = new Array("CR",49);
            arrcountry[55] = new Array("CI",43);
            arrcountry[56] = new Array("HR",98);
            arrcountry[57] = new Array("CU",52);
            arrcountry[58] = new Array("CY",55);
            arrcountry[59] = new Array("CZ",56);
            arrcountry[60] = new Array("DK",59);
            arrcountry[61] = new Array("DJ",58);
            arrcountry[62] = new Array("DM",60);
            arrcountry[63] = new Array("DO",61);
            arrcountry[64] = new Array("TP",221);
            arrcountry[65] = new Array("EC",63);
            arrcountry[66] = new Array("EG",65);
            arrcountry[67] = new Array("SV",208);
            arrcountry[68] = new Array("GQ",88);
            arrcountry[69] = new Array("ER",67);
            arrcountry[70] = new Array("EE",64);
            arrcountry[71] = new Array("ET",69);
            arrcountry[72] = new Array("FK",72);
            arrcountry[73] = new Array("FO",74);
            arrcountry[74] = new Array("FJ",71);
            arrcountry[75] = new Array("FI",70);
            arrcountry[76] = new Array("FR",75);
            arrcountry[77] = new Array("GF",80);
            arrcountry[78] = new Array("PF",175);
            arrcountry[79] = new Array("TF",213);
            arrcountry[80] = new Array("GA",76);
            arrcountry[81] = new Array("GM",85);
            arrcountry[82] = new Array("GE",79);
            arrcountry[83] = new Array("DE",57);
            arrcountry[84] = new Array("GH",82);
            arrcountry[85] = new Array("GI",83);
            arrcountry[86] = new Array("GR",89);
            arrcountry[87] = new Array("GL",84);
            arrcountry[88] = new Array("GD",78);
            arrcountry[89] = new Array("GP",87);
            arrcountry[90] = new Array("GU",92);
            arrcountry[91] = new Array("GT",91);
            arrcountry[92] = new Array("GG",81);
            arrcountry[93] = new Array("GN",86);
            arrcountry[94] = new Array("GW",93);
            arrcountry[95] = new Array("GY",94);
            arrcountry[96] = new Array("HT",99);
            arrcountry[97] = new Array("HM",96);
            arrcountry[98] = new Array("VA",233);
            arrcountry[99] = new Array("HN",97);
            arrcountry[100] = new Array("HK",95);
            arrcountry[101] = new Array("HU",100);
            arrcountry[102] = new Array("IS",109);
            arrcountry[103] = new Array("IN",105);
            arrcountry[104] = new Array("ID",101);
            arrcountry[105] = new Array("IR",108);
            arrcountry[106] = new Array("IQ",107);
            arrcountry[107] = new Array("IE",102);
            arrcountry[108] = new Array("IM",104);
            arrcountry[109] = new Array("IL",103);
            arrcountry[110] = new Array("IT",110);
            arrcountry[111] = new Array("JM",112);
            arrcountry[112] = new Array("JP",114);
            arrcountry[113] = new Array("JE",111);
            arrcountry[114] = new Array("JO",113);
            arrcountry[115] = new Array("KZ",125);
            arrcountry[116] = new Array("KE",115);
            arrcountry[117] = new Array("KI",118);
            arrcountry[118] = new Array("KP",121);
            arrcountry[119] = new Array("KR",122);
            arrcountry[120] = new Array("KW",123);
            arrcountry[121] = new Array("KG",116);
            arrcountry[122] = new Array("LA",126);
            arrcountry[123] = new Array("LV",135);
            arrcountry[124] = new Array("LB",127);
            arrcountry[125] = new Array("LS",132);
            arrcountry[126] = new Array("LR",131);
            arrcountry[127] = new Array("LY",136);
            arrcountry[128] = new Array("LI",129);
            arrcountry[129] = new Array("LT",133);
            arrcountry[130] = new Array("LU",134);
            arrcountry[131] = new Array("MO",148);
            arrcountry[132] = new Array("MK",144);
            arrcountry[133] = new Array("MG",142);
            arrcountry[134] = new Array("MW",156);
            arrcountry[135] = new Array("MY",158);
            arrcountry[136] = new Array("MV",155);
            arrcountry[137] = new Array("ML",145);
            arrcountry[138] = new Array("MT",153);
            arrcountry[139] = new Array("MH",143);
            arrcountry[140] = new Array("MQ",150);
            arrcountry[141] = new Array("MR",151);
            arrcountry[142] = new Array("MU",154);
            arrcountry[143] = new Array("YT",243);
            arrcountry[144] = new Array("MX",157);
            arrcountry[145] = new Array("FM",73);
            arrcountry[146] = new Array("MD",139);
            arrcountry[147] = new Array("MC",138);
            arrcountry[148] = new Array("MN",147);
            arrcountry[149] = new Array("ME",140);
            arrcountry[150] = new Array("MS",152);
            arrcountry[151] = new Array("MA",137);
            arrcountry[152] = new Array("MZ",159);
            arrcountry[153] = new Array("MM",146);
            arrcountry[154] = new Array("NA",160);
            arrcountry[155] = new Array("NR",169);
            arrcountry[156] = new Array("NP",168);
            arrcountry[157] = new Array("NL",166);
            arrcountry[158] = new Array("AN",8);
            arrcountry[159] = new Array("NC",161);
            arrcountry[160] = new Array("NZ",171);
            arrcountry[161] = new Array("NI",165);
            arrcountry[162] = new Array("NE",162);
            arrcountry[163] = new Array("NG",164);
            arrcountry[164] = new Array("NU",170);
            arrcountry[165] = new Array("NF",163);
            arrcountry[166] = new Array("MP",149);
            arrcountry[167] = new Array("NO",167);
            arrcountry[168] = new Array("OM",172);
            arrcountry[169] = new Array("PK",178);
            arrcountry[170] = new Array("PW",185);
            arrcountry[171] = new Array("PS",183);
            arrcountry[172] = new Array("PA",173);
            arrcountry[173] = new Array("PG",176);
            arrcountry[174] = new Array("PY",186);
            arrcountry[175] = new Array("PE",174);
            arrcountry[176] = new Array("PH",177);
            arrcountry[177] = new Array("PN",181);
            arrcountry[178] = new Array("PL",179);
            arrcountry[179] = new Array("PT",184);
            arrcountry[180] = new Array("PR",182);
            arrcountry[181] = new Array("QA",187);
            arrcountry[182] = new Array("RE",188);
            arrcountry[183] = new Array("RO",189);
            arrcountry[184] = new Array("RU",190);
            arrcountry[185] = new Array("RW",191);
            arrcountry[186] = new Array("BL",26);
            arrcountry[187] = new Array("SH",198);
            arrcountry[188] = new Array("KN",120);
            arrcountry[189] = new Array("LC",128);
            arrcountry[190] = new Array("MF",141);
            arrcountry[191] = new Array("VC",234);
            arrcountry[192] = new Array("WS",241);
            arrcountry[193] = new Array("SM",203);
            arrcountry[194] = new Array("ST",207);
            arrcountry[195] = new Array("SA",192);
            arrcountry[196] = new Array("SN",204);
            arrcountry[197] = new Array("RS",50);
            arrcountry[198] = new Array("CS",51);
            arrcountry[199] = new Array("SC",194);
            arrcountry[200] = new Array("SL",202);
            arrcountry[201] = new Array("SG",197);
            arrcountry[202] = new Array("SK",201);
            arrcountry[203] = new Array("SI",199);
            arrcountry[204] = new Array("SB",193);
            arrcountry[205] = new Array("SO",205);
            arrcountry[206] = new Array("ZA",244);
            arrcountry[207] = new Array("GS",90);
            arrcountry[208] = new Array("ES",68);
            arrcountry[209] = new Array("LK",130);
            arrcountry[210] = new Array("PM",180);
            arrcountry[211] = new Array("SD",195);
            arrcountry[212] = new Array("SR",206);
            arrcountry[213] = new Array("SJ",200);
            arrcountry[214] = new Array("SZ",210);
            arrcountry[215] = new Array("SE",196);
            arrcountry[216] = new Array("CH",42);
            arrcountry[217] = new Array("SY",209);
            arrcountry[218] = new Array("TW",225);
            arrcountry[219] = new Array("TJ",216);
            arrcountry[220] = new Array("TZ",226);
            arrcountry[221] = new Array("TH",215);
            arrcountry[222] = new Array("TG",214);
            arrcountry[223] = new Array("TK",217);
            arrcountry[224] = new Array("TO",220);
            arrcountry[225] = new Array("TT",223);
            arrcountry[226] = new Array("TN",219);
            arrcountry[227] = new Array("TR",222);
            arrcountry[228] = new Array("TM",218);
            arrcountry[229] = new Array("TC",211);
            arrcountry[230] = new Array("TV",224);
            arrcountry[231] = new Array("UG",228);
            arrcountry[232] = new Array("UA",227);
            arrcountry[233] = new Array("AE",2);
            arrcountry[234] = new Array("GB",77);
            arrcountry[235] = new Array("US",230);
            arrcountry[236] = new Array("UY",231);
            arrcountry[237] = new Array("UM",229);
            arrcountry[238] = new Array("UZ",232);
            arrcountry[239] = new Array("VU",239);
            arrcountry[240] = new Array("VE",235);
            arrcountry[241] = new Array("VN",238);
            arrcountry[242] = new Array("VG",236);
            arrcountry[243] = new Array("VI",237);
            arrcountry[244] = new Array("WF",240);
            arrcountry[245] = new Array("EH",66);
            arrcountry[246] = new Array("YE",242);
            arrcountry[247] = new Array("ZM",245);
            arrcountry[248] = new Array("ZW",246);

            for(let i = 0; i < arrcountry.length; i++){
                if(arrcountry[i][0] == code.toString())
                    return arrcountry[i][1];
            }

            return null;
        }

        return {
            getResults: getResults,
            isTransactionStandAlone: isTransactionStandAlone,
            isOWA: isOWA,
            getSubsidiaryTimeZoneAndDateFormat: getSubsidiaryTimeZoneAndDateFormat,
            getUserTimeZoneAndDateFormat: getUserTimeZoneAndDateFormat,

            isEmpty: isEmpty,
            zipArrays: zipArrays,
            uniqueByKey: uniqueByKey,
            uniqueByElement: uniqueByElement,
            groupBy: groupBy,
            chunkArray: chunkArray,
            roundDecimal: roundDecimal,
            numberWithCommas: numberWithCommas,
            formatCurrency: formatCurrency,
            parseNum: parseNum,
            objectifyQueryString: objectifyQueryString,
            amountToWords: amountToWords,
            decimalToHours: decimalToHours,
            monthDiff: monthDiff,
            pad: pad,
            getEmailRecipients: getEmailRecipients,
            CSVToArray: CSVToArray,
            getCountryByCode: getCountryByCode
        };

    });
