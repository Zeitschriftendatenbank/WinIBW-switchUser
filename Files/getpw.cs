using System;
using System.IO;
using System.Security;
using System.Runtime.InteropServices;
using System.Text;

class GetPw
{
    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CryptUnprotectData(
        ref DATA_BLOB pDataIn,
        IntPtr ppszDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        uint dwFlags,
        ref DATA_BLOB pDataOut
    );

    [StructLayout(LayoutKind.Sequential)]
    private struct DATA_BLOB
    {
        public int cbData;
        public IntPtr pbData;
    }

    static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("Usage: getpw.exe <file>");
            return 2;
        }

        try
        {
            string file = args[0];

            if (!File.Exists(file))
            {
                Console.Error.WriteLine("File not found: " + file);
                return 3;
            }

            string encrypted = File.ReadAllText(file).Trim();

            if (encrypted.Length == 0)
            {
                Console.Error.WriteLine("Encrypted file is empty.");
                return 4;
            }

            byte[] blob = HexToBytes(encrypted);

            DATA_BLOB input = new DATA_BLOB();
            DATA_BLOB output = new DATA_BLOB();

            input.cbData = blob.Length;
            input.pbData = Marshal.AllocHGlobal(blob.Length);

            try
            {
                Marshal.Copy(blob, 0, input.pbData, blob.Length);

                if (!CryptUnprotectData(
                    ref input,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    0,
                    ref output))
                {
                    int error = Marshal.GetLastWin32Error();

                    Console.Error.WriteLine(
                        "CryptUnprotectData failed. Error: " + error);

                    return 5;
                }

                byte[] decrypted = new byte[output.cbData];

                Marshal.Copy(
                    output.pbData,
                    decrypted,
                    0,
                    output.cbData);

                Console.Write(EncodingFromBytes(decrypted));

                return 0;
            }
            finally
            {
                if (input.pbData != IntPtr.Zero)
                    Marshal.FreeHGlobal(input.pbData);

                if (output.pbData != IntPtr.Zero)
                    Marshal.FreeHGlobal(output.pbData);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
    }

    private static byte[] HexToBytes(string hex)
    {
        if ((hex.Length & 1) != 0)
            throw new Exception("Invalid hexadecimal data.");

        byte[] result = new byte[hex.Length / 2];

        for (int i = 0; i < result.Length; i++)
        {
            result[i] = Convert.ToByte(
                hex.Substring(i * 2, 2),
                16);
        }

        return result;
    }

    private static string EncodingFromBytes(byte[] data)
    {
        return System.Text.Encoding.Unicode.GetString(data).TrimEnd('\0');
    }
}