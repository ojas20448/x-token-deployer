import { CommandParser } from '../CommandParser.js';

describe('CommandParser', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser('MyBot');
    });

    it('should parse valid command case-insensitive', () => {
        const text = '@MyBot deploy\nTicker: TEST\nName: Test Token';
        const result = parser.parse(text);
        expect(result).toEqual({
            ticker: 'TEST',
            name: 'Test Token'
        });
    });

    it('should parse valid command with extra whitespace', () => {
        const text = '  @mybot   deploy  \n  ticker:   OJAS  \n  name:   Ojas Narang  ';
        const result = parser.parse(text);
        expect(result).toEqual({
            ticker: 'OJAS',
            name: 'Ojas Narang'
        });
    });

    it('should fail if bot mention is missing', () => {
        const text = 'deploy\nticker: TEST\nname: Test Token';
        expect(parser.parse(text)).toBeNull();
    });

    it('should fail if deploy keyword is missing', () => {
        const text = '@MyBot hello\nticker: TEST\nname: Test Token';
        expect(parser.parse(text)).toBeNull();
    });

    it('should fail if ticker is missing', () => {
        const text = '@MyBot deploy\nname: Test Token';
        expect(parser.parse(text)).toBeNull();
    });

    it('should fail if name is missing', () => {
        const text = '@MyBot deploy\nticker: TEST';
        expect(parser.parse(text)).toBeNull();
    });

    it('should fail if ticker has invalid characters', () => {
        const text = '@MyBot deploy\nticker: TE$T\nname: Test Token';
        expect(parser.parse(text)).toBeNull();
    });
});
